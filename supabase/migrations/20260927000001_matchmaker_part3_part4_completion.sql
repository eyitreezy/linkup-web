-- MatchMaker Part 3/4: shared activity state, post-meetup reflection, notifications, plan hook

ALTER TABLE public.matchmaker_reflection_responses
  ADD COLUMN IF NOT EXISTS post_meetup_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS post_meetup_skipped BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS matchmaker_nudges_own ON public.matchmaker_nudges;
CREATE POLICY matchmaker_nudges_own ON public.matchmaker_nudges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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
      'partner_answer', NULL
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
    END
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
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status = 'active';

  IF v_conn.id IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;

  IF v_conn.connected_at > NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'shared_activity_locked';
  END IF;

  v_is_user_a := v_conn.user_a_id = v_user;

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
      CASE WHEN v_is_user_a THEN p_answers ELSE NULL END,
      CASE WHEN NOT v_is_user_a THEN p_answers ELSE NULL END,
      CASE WHEN v_is_user_a THEN NOW() ELSE NULL END,
      CASE WHEN NOT v_is_user_a THEN NOW() ELSE NULL END
    );
  ELSE
    IF v_is_user_a AND v_activity.user_a_answers IS NULL THEN
      UPDATE public.matchmaker_shared_activities
      SET user_a_answers = p_answers, a_submitted_at = NOW()
      WHERE id = v_activity.id;
    ELSIF NOT v_is_user_a AND v_activity.user_b_answers IS NULL THEN
      UPDATE public.matchmaker_shared_activities
      SET user_b_answers = p_answers, b_submitted_at = NOW()
      WHERE id = v_activity.id;
    ELSE
      RAISE EXCEPTION 'answer_already_submitted';
    END IF;
  END IF;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF v_activity.user_a_answers IS NOT NULL
     AND v_activity.user_b_answers IS NOT NULL
     AND v_activity.revealed_at IS NULL THEN
    UPDATE public.matchmaker_shared_activities SET revealed_at = NOW()
    WHERE id = v_activity.id
    RETURNING * INTO v_activity;

    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = v_user;
    v_partner := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

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

CREATE OR REPLACE FUNCTION public.matchmaker_send_ready_signal(p_connection_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_partner UUID;
  v_days_left INT;
  v_name TEXT;
  v_chat_id UUID;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status = 'active';

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'connection_not_found';
  END IF;

  IF v_conn.connected_at > NOW() - INTERVAL '10 days' THEN
    RAISE EXCEPTION 'too_early';
  END IF;

  INSERT INTO public.matchmaker_ready_signals (connection_id, signalling_user_id)
  VALUES (p_connection_id, v_user)
  ON CONFLICT (connection_id, signalling_user_id) DO NOTHING;

  v_partner := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

  SELECT display_name INTO v_name FROM public.profiles WHERE user_id = v_user;

  v_days_left := GREATEST(
    0,
    COALESCE(
      CEIL(EXTRACT(EPOCH FROM (v_conn.plan_unlock_at - NOW())) / 86400)::INT,
      21
    )
  );

  SELECT id INTO v_chat_id FROM public.conversations
  WHERE matchmaker_connection_id = p_connection_id
  LIMIT 1;

  PERFORM public.create_notification(
    v_partner,
    'matchmaker_ready_signal',
    COALESCE(v_name, 'Your match') || ' feels ready to meet',
    'No pressure. Your plan window opens in ' || v_days_left::text || ' days. Keep the conversation going.',
    jsonb_build_object(
      'connection_id', p_connection_id,
      'chatId', v_chat_id,
      'href', CASE WHEN v_chat_id IS NOT NULL THEN '/messages?c=' || v_chat_id::text ELSE '/messages' END
    ),
    'medium',
    'matchmaker_ready:' || p_connection_id::text || ':' || v_user::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_should_show_post_meetup(p_connection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_has_completed_plan BOOLEAN;
  v_has_reflection BOOLEAN;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status = 'active';

  IF v_conn.id IS NULL THEN
    RETURN jsonb_build_object('show', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.matchmaker_connection_id = p_connection_id
      AND p.status = 'completed'
  ) INTO v_has_completed_plan;

  IF NOT v_has_completed_plan THEN
    RETURN jsonb_build_object('show', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matchmaker_reflection_responses r
    WHERE r.connection_id = p_connection_id AND r.user_id = v_user
      AND (r.post_meetup_feeling IS NOT NULL OR r.post_meetup_skipped OR r.post_meetup_path IS NOT NULL)
  ) INTO v_has_reflection;

  RETURN jsonb_build_object('show', NOT v_has_reflection);
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_save_post_meetup_reflection(
  p_connection_id UUID,
  p_feeling TEXT,
  p_quality TEXT,
  p_skipped BOOLEAN,
  p_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  INSERT INTO public.matchmaker_reflection_responses (
    connection_id, user_id,
    post_meetup_feeling, post_meetup_quality,
    post_meetup_skipped, post_meetup_path
  )
  VALUES (
    p_connection_id, v_user,
    p_feeling, p_quality,
    COALESCE(p_skipped, false), p_path
  )
  ON CONFLICT (connection_id, user_id) DO UPDATE SET
    post_meetup_feeling = COALESCE(EXCLUDED.post_meetup_feeling, matchmaker_reflection_responses.post_meetup_feeling),
    post_meetup_quality = COALESCE(EXCLUDED.post_meetup_quality, matchmaker_reflection_responses.post_meetup_quality),
    post_meetup_skipped = matchmaker_reflection_responses.post_meetup_skipped OR COALESCE(EXCLUDED.post_meetup_skipped, false),
    post_meetup_path = COALESCE(EXCLUDED.post_meetup_path, matchmaker_reflection_responses.post_meetup_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_on_plan_created_set_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.matchmaker_connection_id IS NOT NULL THEN
    UPDATE public.matchmaker_connections
    SET first_plan_created_at = COALESCE(first_plan_created_at, NOW())
    WHERE id = NEW.matchmaker_connection_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matchmaker_plan_created_connection ON public.plans;
CREATE TRIGGER matchmaker_plan_created_connection
  AFTER INSERT ON public.plans
  FOR EACH ROW
  WHEN (NEW.matchmaker_connection_id IS NOT NULL)
  EXECUTE FUNCTION public.matchmaker_on_plan_created_set_connection();

CREATE OR REPLACE FUNCTION public.matchmaker_send_day21_unlocks()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  participant UUID;
  v_nudge_id UUID;
BEGIN
  FOR r IN
    SELECT mc.id, mc.user_a_id, mc.user_b_id
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'active'
      AND mc.plan_unlock_at IS NOT NULL
      AND mc.plan_unlock_at <= NOW()
      AND mc.first_message_at IS NOT NULL
  LOOP
    FOREACH participant IN ARRAY ARRAY[r.user_a_id, r.user_b_id]
    LOOP
      v_nudge_id := NULL;
      INSERT INTO public.matchmaker_nudges (connection_id, user_id, nudge_type)
      VALUES (r.id, participant, 'day_21_unlock')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_nudge_id;

      IF v_nudge_id IS NOT NULL THEN
        PERFORM public.create_notification(
          participant,
          'matchmaker_plan_unlocked',
          'Your MatchMaker plan window is now open',
          'When you are both ready, create a plan and take your connection into the real world.',
          jsonb_build_object(
            'connection_id', r.id,
            'href', '/matchmaker/connection/' || r.id::text
          ),
          'high',
          'matchmaker_day21:' || r.id::text || ':' || participant::text
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_notify_mutual_connection(
  p_connection_id UUID,
  p_user_id UUID,
  p_partner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(btrim(display_name), ''), 'Your match') INTO v_partner_name
  FROM public.profiles WHERE user_id = p_partner_id;

  PERFORM public.create_notification(
    p_user_id,
    'matchmaker_mutual_connection',
    'You have a new MatchMaker connection',
    v_partner_name || ' and you expressed mutual interest. Your connection has begun.',
    jsonb_build_object(
      'connection_id', p_connection_id,
      'connectionId', p_connection_id,
      'href', '/matchmaker/connection/' || p_connection_id::text
    ),
    'high',
    'matchmaker_mutual:' || p_connection_id::text || ':' || p_user_id::text
  );
END;
$$;

-- Patch express_interest mutual branch notifications only (body of latest function retained elsewhere)
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

  IF v_existing_status IS NOT NULL THEN
    RETURN jsonb_build_object(
      'matched', false,
      'already_sent', true,
      'interest_status', v_existing_status
    );
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

    PERFORM public.matchmaker_notify_mutual_connection(v_new_connection_id, v_from, p_to_user_id);
    PERFORM public.matchmaker_notify_mutual_connection(v_new_connection_id, p_to_user_id, v_from);

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
  );

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
    RETURN jsonb_build_object('matched', false, 'already_sent', true);
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_get_shared_activity_state(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_should_show_post_meetup(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_save_post_meetup_reflection(UUID, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_notify_mutual_connection(UUID, UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.matchmaker_get_shared_activity_state(UUID, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_should_show_post_meetup(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_save_post_meetup_reflection(UUID, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_notify_mutual_connection(UUID, UUID, UUID) TO service_role;
