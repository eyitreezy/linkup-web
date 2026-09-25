-- MatchMaker: gender_not_set gate, Interest Queue RPCs, silent queueing, end_connection surfacing.

-- ---------------------------------------------------------------------------
-- Interest queue: surfaced_at tracks when receiver can see a pending interest
-- ---------------------------------------------------------------------------
ALTER TABLE public.matchmaker_interests
  ADD COLUMN IF NOT EXISTS surfaced_at TIMESTAMPTZ;

UPDATE public.matchmaker_interests
SET surfaced_at = expressed_at
WHERE surfaced_at IS NULL;

CREATE INDEX IF NOT EXISTS matchmaker_interests_to_status_idx
  ON public.matchmaker_interests (to_user_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS matchmaker_interests_from_status_idx
  ON public.matchmaker_interests (from_user_id, status)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_user_has_active_connection(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matchmaker_connections mc
    WHERE (mc.user_a_id = p_user_id OR mc.user_b_id = p_user_id)
      AND mc.status IN ('active', 'paused')
  );
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_interest_pair_excluded(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matchmaker_exclusions me
    WHERE (me.user_a_id = p_user_a AND me.user_b_id = p_user_b)
       OR (me.user_a_id = p_user_b AND me.user_b_id = p_user_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_expire_stale_interests()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.matchmaker_interests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= NOW();
$$;

-- ---------------------------------------------------------------------------
-- Gate state: gender_not_set before intent/values
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_get_gate_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_verification TEXT;
  v_intent BOOLEAN;
  v_values BOOLEAN;
  v_cooldown_until TIMESTAMPTZ;
  v_suspension_until TIMESTAMPTZ;
  v_connection_id UUID;
  v_connection_status TEXT;
  v_viewer_gender TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.matchmaker_user_has_gold_access(v_user) THEN
    RETURN jsonb_build_object('gate', 'subscription');
  END IF;

  SELECT verification_status INTO v_verification
  FROM public.users WHERE id = v_user;

  IF COALESCE(v_verification, 'unverified') <> 'verified' THEN
    RETURN jsonb_build_object('gate', 'kyc');
  END IF;

  SELECT cooldown_until INTO v_suspension_until
  FROM public.matchmaker_cooldowns
  WHERE user_id = v_user
    AND cooldown_until > NOW()
    AND reason = 'contact_sharing';

  IF v_suspension_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'gate', 'suspended',
      'suspension_until', v_suspension_until
    );
  END IF;

  SELECT cooldown_until INTO v_cooldown_until
  FROM public.matchmaker_cooldowns
  WHERE user_id = v_user
    AND cooldown_until > NOW()
    AND reason <> 'contact_sharing';

  IF v_cooldown_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'gate', 'cooldown',
      'cooldown_until', v_cooldown_until
    );
  END IF;

  SELECT public.matchmaker_pool_gender(gender) INTO v_viewer_gender
  FROM public.profiles
  WHERE user_id = v_user;

  IF v_viewer_gender IS NULL THEN
    RETURN jsonb_build_object('gate', 'gender_not_set');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matchmaker_intents
    WHERE user_id = v_user AND is_active = true
  ) INTO v_intent;

  IF NOT v_intent THEN
    RETURN jsonb_build_object('gate', 'intent');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matchmaker_values WHERE user_id = v_user
  ) INTO v_values;

  IF NOT v_values THEN
    RETURN jsonb_build_object('gate', 'values');
  END IF;

  SELECT id, status INTO v_connection_id, v_connection_status
  FROM public.matchmaker_connections
  WHERE (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused')
  ORDER BY connected_at DESC
  LIMIT 1;

  IF v_connection_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'gate', 'connection',
      'connection_id', v_connection_id,
      'connection_status', v_connection_status
    );
  END IF;

  RETURN jsonb_build_object('gate', 'open');
END;
$$;

-- ---------------------------------------------------------------------------
-- Express interest: silent queue when target is connected
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.matchmaker_interests (from_user_id, to_user_id, status, surfaced_at)
  VALUES (
    v_from,
    p_to_user_id,
    'pending',
    CASE WHEN v_target_connected THEN NULL ELSE NOW() END
  )
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE
  SET
    status = 'pending',
    expressed_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    surfaced_at = CASE
      WHEN v_target_connected THEN NULL
      ELSE COALESCE(public.matchmaker_interests.surfaced_at, NOW())
    END
  WHERE public.matchmaker_interests.status IN ('pending', 'passed', 'expired');

  IF NOT v_target_connected THEN
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

-- ---------------------------------------------------------------------------
-- Pass on received interest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_pass_interest(p_from_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_updated INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.matchmaker_expire_stale_interests();

  UPDATE public.matchmaker_interests
  SET status = 'passed'
  WHERE from_user_id = p_from_user_id
    AND to_user_id = v_user
    AND status = 'pending'
    AND expires_at > NOW()
    AND surfaced_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Interest queue fetch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_get_interest_queue()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_sent JSONB;
  v_received JSONB;
  v_received_count INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.matchmaker_expire_stale_interests();

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.expressed_at DESC), '[]'::jsonb) INTO v_sent
  FROM (
    SELECT
      mi.id AS interest_id,
      mi.from_user_id AS user_id,
      mi.status,
      mi.expressed_at,
      mi.expires_at,
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
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.expressed_at DESC), '[]'::jsonb) INTO v_received
  FROM (
    SELECT
      mi.id AS interest_id,
      mi.from_user_id AS user_id,
      mi.status,
      mi.expressed_at,
      mi.expires_at,
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
  ) t;

  SELECT COUNT(*)::INT INTO v_received_count
  FROM public.matchmaker_interests mi
  WHERE mi.to_user_id = v_user
    AND mi.status = 'pending'
    AND mi.expires_at > NOW()
    AND mi.surfaced_at IS NOT NULL
    AND NOT public.matchmaker_interest_pair_excluded(mi.from_user_id, mi.to_user_id);

  RETURN jsonb_build_object(
    'sent', v_sent,
    'received', v_received,
    'received_count', v_received_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- End connection: exclusion + surface queued interests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_end_connection(
  p_connection_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_sub_threshold BOOLEAN;
  v_recent_sub_threshold INT;
  v_partner UUID;
  v_user_a UUID;
  v_user_b UUID;
  r_interest RECORD;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused');

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'connection_not_found';
  END IF;

  v_sub_threshold := (
    v_conn.first_message_at IS NULL
    OR v_conn.plan_unlock_at IS NULL
    OR v_conn.plan_unlock_at > NOW()
  );

  UPDATE public.matchmaker_connections SET
    status = 'ended',
    ended_at = NOW(),
    ended_by = v_user,
    end_reason = p_reason
  WHERE id = p_connection_id;

  v_partner := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;
  v_user_a := LEAST(v_conn.user_a_id, v_conn.user_b_id);
  v_user_b := GREATEST(v_conn.user_a_id, v_conn.user_b_id);

  INSERT INTO public.matchmaker_exclusions (user_a_id, user_b_id)
  VALUES (v_user_a, v_user_b)
  ON CONFLICT DO NOTHING;

  PERFORM public.create_notification(
    v_partner,
    'matchmaker_connection_ended',
    'Connection ended',
    'This connection has ended.',
    jsonb_build_object('href', '/matchmaker/reflect'),
    'medium',
    'matchmaker_ended:' || p_connection_id::text || ':' || v_partner::text
  );

  IF v_sub_threshold THEN
    SELECT COUNT(*) INTO v_recent_sub_threshold
    FROM public.matchmaker_connections
    WHERE (user_a_id = v_user OR user_b_id = v_user)
      AND status = 'ended'
      AND ended_at > NOW() - INTERVAL '60 days'
      AND (
        first_message_at IS NULL
        OR plan_unlock_at IS NULL
        OR plan_unlock_at > ended_at
      );

    IF v_recent_sub_threshold >= 3 THEN
      INSERT INTO public.matchmaker_cooldowns (user_id, cooldown_until, reason)
      VALUES (v_user, NOW() + INTERVAL '30 days', 'rapid_cycler')
      ON CONFLICT (user_id) DO UPDATE SET
        cooldown_until = EXCLUDED.cooldown_until,
        reason = EXCLUDED.reason,
        created_at = NOW();
    END IF;
  END IF;

  UPDATE public.matchmaker_interests
  SET status = 'expired'
  WHERE status = 'pending'
    AND (
      (from_user_id = v_conn.user_a_id AND to_user_id = v_conn.user_b_id)
      OR (from_user_id = v_conn.user_b_id AND to_user_id = v_conn.user_a_id)
    );

  UPDATE public.matchmaker_interests mi
  SET status = 'expired'
  WHERE mi.status = 'pending'
    AND public.matchmaker_interest_pair_excluded(mi.from_user_id, mi.to_user_id);

  FOR r_interest IN
    SELECT mi.id, mi.from_user_id, mi.to_user_id
    FROM public.matchmaker_interests mi
    WHERE mi.status = 'pending'
      AND mi.surfaced_at IS NULL
      AND mi.to_user_id IN (v_user, v_partner)
      AND mi.expires_at > NOW()
  LOOP
    IF public.matchmaker_interest_pair_excluded(r_interest.from_user_id, r_interest.to_user_id) THEN
      UPDATE public.matchmaker_interests SET status = 'expired' WHERE id = r_interest.id;
    ELSE
      UPDATE public.matchmaker_interests SET surfaced_at = NOW() WHERE id = r_interest.id;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants + realtime
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.matchmaker_user_has_active_connection(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_pass_interest(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_interest_queue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_expire_stale_interests() TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matchmaker_interests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaker_interests;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
