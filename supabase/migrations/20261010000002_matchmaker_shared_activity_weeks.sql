-- Shared activity: per-week unlock from connected_at, overview RPC for badges.

CREATE OR REPLACE FUNCTION public.matchmaker_shared_activity_catalog_weeks()
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 8;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_shared_activity_days_elapsed(p_connected_at TIMESTAMPTZ)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - p_connected_at)) / 86400)::INT);
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_shared_activity_max_unlocked_week(p_connected_at TIMESTAMPTZ)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.matchmaker_shared_activity_days_elapsed(p_connected_at) < 6 THEN 0
    ELSE LEAST(
      public.matchmaker_shared_activity_catalog_weeks(),
      1 + (
        (public.matchmaker_shared_activity_days_elapsed(p_connected_at) - 6) / 7
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_shared_activity_week_unlocked(
  p_connected_at TIMESTAMPTZ,
  p_week_number INT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_week_number >= 1
    AND p_week_number <= public.matchmaker_shared_activity_catalog_weeks()
    AND public.matchmaker_shared_activity_days_elapsed(p_connected_at) >= 6 + (p_week_number - 1) * 7;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_shared_activity_overview(p_connection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_max_week INT;
  v_week INT;
  v_rows JSONB := '[]'::jsonb;
  v_pending INT := 0;
  v_activity public.matchmaker_shared_activities%ROWTYPE;
  v_is_user_a BOOLEAN;
  v_my JSONB;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused');

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  v_max_week := public.matchmaker_shared_activity_max_unlocked_week(v_conn.connected_at);
  v_is_user_a := v_conn.user_a_id = v_user;

  FOR v_week IN 1..v_max_week LOOP
    SELECT * INTO v_activity FROM public.matchmaker_shared_activities
    WHERE connection_id = p_connection_id AND week_number = v_week;

    IF v_is_user_a THEN
      v_my := v_activity.user_a_answers;
    ELSE
      v_my := v_activity.user_b_answers;
    END IF;

    IF v_my IS NULL THEN
      v_pending := v_pending + 1;
    END IF;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'week_number', v_week,
      'unlocked', true,
      'my_submitted', v_my IS NOT NULL,
      'revealed', v_activity.revealed_at IS NOT NULL
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'max_unlocked_week', v_max_week,
    'pending_badge_count', v_pending,
    'weeks', v_rows
  );
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

  IF NOT public.matchmaker_shared_activity_week_unlocked(v_conn.connected_at, p_week_number) THEN
    RAISE EXCEPTION 'shared_activity_locked';
  END IF;

  v_is_user_a := v_conn.user_a_id = v_user;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF v_activity.id IS NULL THEN
    RETURN jsonb_build_object(
      'week_number', p_week_number,
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
    'week_number', p_week_number,
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
  v_q1 TEXT;
  v_normalized JSONB;
  v_name TEXT;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused');

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  IF NOT public.matchmaker_shared_activity_week_unlocked(v_conn.connected_at, p_week_number) THEN
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
        'week_number', p_week_number,
        'href', '/matchmaker/connection/' || p_connection_id::text || '/activity?week=' || p_week_number::text
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
        'week_number', p_week_number,
        'href', '/matchmaker/connection/' || p_connection_id::text || '/activity?week=' || p_week_number::text
      ),
      'medium',
      'matchmaker_activity:' || v_activity.id::text || ':' || v_partner::text
    );

    RETURN jsonb_build_object('revealed', true, 'week_number', p_week_number);
  END IF;

  RETURN jsonb_build_object('revealed', false, 'week_number', p_week_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaker_get_shared_activity_overview(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_shared_activity_max_unlocked_week(TIMESTAMPTZ) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
