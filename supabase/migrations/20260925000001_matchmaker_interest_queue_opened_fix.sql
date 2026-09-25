-- Fix interest queue fetch, track opened interests, unopened badge count, notification rules.

ALTER TABLE public.matchmaker_interests
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.matchmaker_user_has_ever_connected(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matchmaker_connections mc
    WHERE mc.user_a_id = p_user_id OR mc.user_b_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_mark_interests_opened()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.matchmaker_interests
  SET opened_at = NOW()
  WHERE to_user_id = v_user
    AND status = 'pending'
    AND expires_at > NOW()
    AND surfaced_at IS NOT NULL
    AND opened_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_interest_queue()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_sent JSONB := '[]'::jsonb;
  v_received JSONB := '[]'::jsonb;
  v_received_count INT := 0;
  v_received_unopened_count INT := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.matchmaker_expire_stale_interests();

  SELECT COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.expressed_at DESC)
      FROM (
        SELECT
          mi.id AS interest_id,
          mi.to_user_id AS user_id,
          mi.status,
          mi.expressed_at,
          mi.expires_at,
          mi.opened_at,
          p.display_name,
          p.birth_date,
          p.location_label,
          p.photo_urls,
          p.primary_photo_url,
          p.avatar_url,
          p.preferences,
          p.communication_style,
          p.verified_badge
        FROM public.matchmaker_interests mi
        INNER JOIN public.profiles p ON p.user_id = mi.to_user_id
        WHERE mi.from_user_id = v_user
          AND mi.status = 'pending'
          AND mi.expires_at > NOW()
      ) t
    ),
    '[]'::jsonb
  ) INTO v_sent;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.expressed_at DESC)
      FROM (
        SELECT
          mi.id AS interest_id,
          mi.from_user_id AS user_id,
          mi.status,
          mi.expressed_at,
          mi.expires_at,
          mi.opened_at,
          p.display_name,
          p.birth_date,
          p.location_label,
          p.photo_urls,
          p.primary_photo_url,
          p.avatar_url,
          p.preferences,
          p.communication_style,
          p.verified_badge
        FROM public.matchmaker_interests mi
        INNER JOIN public.profiles p ON p.user_id = mi.from_user_id
        WHERE mi.to_user_id = v_user
          AND mi.status = 'pending'
          AND mi.expires_at > NOW()
          AND mi.surfaced_at IS NOT NULL
          AND NOT public.matchmaker_interest_pair_excluded(mi.from_user_id, mi.to_user_id)
      ) t
    ),
    '[]'::jsonb
  ) INTO v_received;

  SELECT COUNT(*)::INT INTO v_received_count
  FROM public.matchmaker_interests mi
  WHERE mi.to_user_id = v_user
    AND mi.status = 'pending'
    AND mi.expires_at > NOW()
    AND mi.surfaced_at IS NOT NULL
    AND NOT public.matchmaker_interest_pair_excluded(mi.from_user_id, mi.to_user_id);

  SELECT COUNT(*)::INT INTO v_received_unopened_count
  FROM public.matchmaker_interests mi
  WHERE mi.to_user_id = v_user
    AND mi.status = 'pending'
    AND mi.expires_at > NOW()
    AND mi.surfaced_at IS NOT NULL
    AND mi.opened_at IS NULL
    AND NOT public.matchmaker_interest_pair_excluded(mi.from_user_id, mi.to_user_id);

  RETURN jsonb_build_object(
    'sent', v_sent,
    'received', v_received,
    'received_count', v_received_count,
    'received_unopened_count', v_received_unopened_count
  );
END;
$$;

-- Notify + email only when target is available and has never matched before.
CREATE OR REPLACE FUNCTION public.matchmaker_express_interest(p_to_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from UUID := auth.uid();
  v_mutual_interest public.matchmaker_interests%ROWTYPE;
  v_new_connection_id UUID;
  v_user_a UUID;
  v_user_b UUID;
  v_target_connected BOOLEAN;
  v_sender_name TEXT;
  v_existing_status TEXT;
  v_should_notify BOOLEAN;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_to_user_id = v_from THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  IF public.matchmaker_user_has_active_connection(v_from) THEN
    RAISE EXCEPTION 'sender_has_active_connection';
  END IF;

  PERFORM public.matchmaker_expire_stale_interests();

  SELECT status INTO v_existing_status
  FROM public.matchmaker_interests
  WHERE from_user_id = v_from AND to_user_id = p_to_user_id;

  IF v_existing_status = 'pending' THEN
    RETURN jsonb_build_object('matched', false, 'already_sent', true);
  END IF;

  SELECT * INTO v_mutual_interest
  FROM public.matchmaker_interests
  WHERE from_user_id = p_to_user_id
    AND to_user_id = v_from
    AND status = 'pending'
    AND expires_at > NOW()
    AND surfaced_at IS NOT NULL;

  IF v_mutual_interest.id IS NOT NULL THEN
    v_user_a := LEAST(v_from, p_to_user_id);
    v_user_b := GREATEST(v_from, p_to_user_id);

    INSERT INTO public.matchmaker_connections (user_a_id, user_b_id, status)
    VALUES (v_user_a, v_user_b, 'active')
    RETURNING id INTO v_new_connection_id;

    UPDATE public.matchmaker_interests SET status = 'accepted'
    WHERE (from_user_id = v_from AND to_user_id = p_to_user_id)
       OR (from_user_id = p_to_user_id AND to_user_id = v_from);

    INSERT INTO public.matchmaker_exclusions (user_a_id, user_b_id)
    VALUES (v_user_a, v_user_b)
    ON CONFLICT DO NOTHING;

    PERFORM public.matchmaker_get_or_create_conversation(v_user_a, v_user_b, v_new_connection_id);

    PERFORM public.create_notification(
      v_from,
      'matchmaker_mutual_connection',
      'New MatchMaker connection',
      'You have a new MatchMaker connection.',
      jsonb_build_object('connection_id', v_new_connection_id, 'href', '/matchmaker/connection/' || v_new_connection_id::text),
      'high',
      'matchmaker_mutual:' || v_new_connection_id::text || ':' || v_from::text
    );

    PERFORM public.create_notification(
      p_to_user_id,
      'matchmaker_mutual_connection',
      'New MatchMaker connection',
      'You have a new MatchMaker connection.',
      jsonb_build_object('connection_id', v_new_connection_id, 'href', '/matchmaker/connection/' || v_new_connection_id::text),
      'high',
      'matchmaker_mutual:' || v_new_connection_id::text || ':' || p_to_user_id::text
    );

    RETURN jsonb_build_object('matched', true, 'connection_id', v_new_connection_id);
  END IF;

  v_target_connected := public.matchmaker_user_has_active_connection(p_to_user_id);

  INSERT INTO public.matchmaker_interests (from_user_id, to_user_id, status, surfaced_at, opened_at)
  VALUES (
    v_from,
    p_to_user_id,
    'pending',
    CASE WHEN v_target_connected THEN NULL ELSE NOW() END,
    NULL
  )
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE
  SET
    status = 'pending',
    expressed_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    opened_at = NULL,
    surfaced_at = CASE
      WHEN v_target_connected THEN NULL
      ELSE COALESCE(public.matchmaker_interests.surfaced_at, NOW())
    END
  WHERE public.matchmaker_interests.status IN ('pending', 'passed', 'expired');

  v_should_notify := NOT v_target_connected AND NOT public.matchmaker_user_has_ever_connected(p_to_user_id);

  IF v_should_notify THEN
    SELECT COALESCE(NULLIF(btrim(display_name), ''), 'Someone') INTO v_sender_name
    FROM public.profiles WHERE user_id = v_from;

    PERFORM public.create_notification(
      p_to_user_id,
      'matchmaker_interest_received',
      'New MatchMaker interest',
      v_sender_name || ' expressed interest in you on MatchMaker.',
      jsonb_build_object('href', '/matchmaker/interests', 'from_user_id', v_from::text),
      'medium',
      'matchmaker_interest:' || v_from::text || ':' || p_to_user_id::text
    );

    BEGIN
      PERFORM net.http_post(
        url := rtrim(current_setting('app.settings.supabase_url', true), '/') || '/functions/v1/send-matchmaker-interest-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'recipientUserId', p_to_user_id::text,
          'senderUserId', v_from::text,
          'senderName', v_sender_name
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'matched', false,
    'queued', v_target_connected,
    'surfaced', NOT v_target_connected
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_new_connection_id
    FROM public.matchmaker_connections
    WHERE user_a_id = LEAST(v_from, p_to_user_id)
      AND user_b_id = GREATEST(v_from, p_to_user_id)
      AND status = 'active'
    LIMIT 1;

    RETURN jsonb_build_object('matched', true, 'connection_id', v_new_connection_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaker_mark_interests_opened() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_user_has_ever_connected(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
