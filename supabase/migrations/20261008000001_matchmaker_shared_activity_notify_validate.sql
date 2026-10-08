-- Shared activity: validate answers (incl. other:custom), notify partner on first submit, keep partner answer concealed until reveal.

CREATE OR REPLACE FUNCTION public.matchmaker_normalize_activity_q1(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_trimmed TEXT;
  v_detail TEXT;
BEGIN
  v_trimmed := NULLIF(TRIM(p_raw), '');
  IF v_trimmed IS NULL THEN
    RAISE EXCEPTION 'answer_required';
  END IF;

  IF v_trimmed LIKE 'other:%' THEN
    v_detail := TRIM(SUBSTRING(v_trimmed FROM 7));
    IF v_detail = '' THEN
      RAISE EXCEPTION 'answer_required';
    END IF;
    IF LENGTH(v_detail) > 100 THEN
      RAISE EXCEPTION 'answer_too_long';
    END IF;
    RETURN 'other:' || v_detail;
  END IF;

  IF LENGTH(v_trimmed) > 100 THEN
    RAISE EXCEPTION 'answer_too_long';
  END IF;

  RETURN v_trimmed;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_shared_activity_state(
  p_connection_id UUID,
  p_week_number INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_activity public.matchmaker_shared_activities%ROWTYPE;
  v_is_user_a BOOLEAN;
  v_my JSONB;
  v_partner JSONB;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused');

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  v_is_user_a := v_conn.user_a_id = v_user;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF v_activity.id IS NULL THEN
    RETURN jsonb_build_object(
      'my_submitted', false,
      'partner_submitted', false,
      'revealed', false,
      'my_answer', NULL,
      'partner_answer', NULL,
      'partner_answer_concealed', false
    );
  END IF;

  IF v_is_user_a THEN
    v_my := v_activity.user_a_answers;
    v_partner := v_activity.user_b_answers;
  ELSE
    v_my := v_activity.user_b_answers;
    v_partner := v_activity.user_a_answers;
  END IF;

  RETURN jsonb_build_object(
    'my_submitted', v_my IS NOT NULL,
    'partner_submitted', v_partner IS NOT NULL,
    'revealed', v_activity.revealed_at IS NOT NULL,
    'my_answer', CASE WHEN v_my IS NOT NULL THEN v_my->>'q1' ELSE NULL END,
    'partner_answer', CASE
      WHEN v_activity.revealed_at IS NOT NULL AND v_partner IS NOT NULL THEN v_partner->>'q1'
      ELSE NULL
    END,
    'partner_answer_concealed', (
      v_partner IS NOT NULL
      AND v_activity.revealed_at IS NULL
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_submit_activity_answer(
  p_connection_id UUID,
  p_week_number INT,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_activity public.matchmaker_shared_activities%ROWTYPE;
  v_is_user_a BOOLEAN;
  v_partner UUID;
  v_name TEXT;
  v_q1 TEXT;
  v_normalized JSONB;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status = 'active';

  IF v_conn.id IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;

  IF v_conn.connected_at > NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'shared_activity_locked';
  END IF;

  v_q1 := public.matchmaker_normalize_activity_q1(p_answers->>'q1');
  v_normalized := jsonb_build_object('q1', v_q1);

  v_is_user_a := v_conn.user_a_id = v_user;
  v_partner := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF v_activity.id IS NULL THEN
    INSERT INTO public.matchmaker_shared_activities (
      connection_id, week_number,
      user_a_answers, user_b_answers,
      a_submitted_at, b_submitted_at
    )
    VALUES (
      p_connection_id, p_week_number,
      CASE WHEN v_is_user_a THEN v_normalized ELSE NULL END,
      CASE WHEN NOT v_is_user_a THEN v_normalized ELSE NULL END,
      CASE WHEN v_is_user_a THEN NOW() ELSE NULL END,
      CASE WHEN NOT v_is_user_a THEN NOW() ELSE NULL END
    );
  ELSE
    IF v_is_user_a AND v_activity.user_a_answers IS NULL THEN
      UPDATE public.matchmaker_shared_activities
      SET user_a_answers = v_normalized, a_submitted_at = NOW()
      WHERE id = v_activity.id;
    ELSIF NOT v_is_user_a AND v_activity.user_b_answers IS NULL THEN
      UPDATE public.matchmaker_shared_activities
      SET user_b_answers = v_normalized, b_submitted_at = NOW()
      WHERE id = v_activity.id;
    ELSE
      RAISE EXCEPTION 'answer_already_submitted';
    END IF;
  END IF;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF (v_activity.user_a_answers IS NOT NULL) <> (v_activity.user_b_answers IS NOT NULL) THEN
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = v_user;

    PERFORM public.create_notification(
      v_partner,
      'matchmaker_activity_shared',
      COALESCE(v_name, 'Your match') || ' shared a MatchMaker activity',
      'Open Shared Activity and submit your answer.',
      jsonb_build_object(
        'connection_id', p_connection_id,
        'href', '/matchmaker/connection/' || p_connection_id::text || '/activity'
      ),
      'medium',
      'matchmaker_activity_pending:' || p_connection_id::text || ':' || p_week_number::text || ':' || v_partner::text
    );
  END IF;

  IF v_activity.user_a_answers IS NOT NULL
     AND v_activity.user_b_answers IS NOT NULL
     AND v_activity.revealed_at IS NULL THEN
    UPDATE public.matchmaker_shared_activities SET revealed_at = NOW()
    WHERE id = v_activity.id
    RETURNING * INTO v_activity;

    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = v_user;

    PERFORM public.create_notification(
      v_partner,
      'matchmaker_activity_revealed',
      COALESCE(v_name, 'Your match') || ' answered',
      'See what you both said.',
      jsonb_build_object(
        'connection_id', p_connection_id,
        'href', '/matchmaker/connection/' || p_connection_id::text || '/activity'
      ),
      'medium',
      'matchmaker_activity:' || v_activity.id::text || ':' || v_partner::text
    );

    RETURN jsonb_build_object('revealed', true);
  END IF;

  RETURN jsonb_build_object('revealed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_normalize_activity_q1(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_normalize_activity_q1(TEXT) TO authenticated, service_role;
