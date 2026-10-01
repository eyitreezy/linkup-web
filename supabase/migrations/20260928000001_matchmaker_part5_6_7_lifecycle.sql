-- MatchMaker Parts 5–7: lifecycle, history, pool visibility, subscription lapse notifications

ALTER TABLE public.matchmaker_intents
  ADD COLUMN IF NOT EXISTS pool_visible BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.matchmaker_user_lifecycle (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reflection_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  healing_started_at TIMESTAMPTZ NULL,
  healing_completed_at TIMESTAMPTZ NULL,
  entered_pool_at TIMESTAMPTZ NULL,
  source_connection_id UUID NULL REFERENCES public.matchmaker_connections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matchmaker_user_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matchmaker_lifecycle_own ON public.matchmaker_user_lifecycle;
CREATE POLICY matchmaker_lifecycle_own ON public.matchmaker_user_lifecycle
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.matchmaker_resolve_lifecycle_phase(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.matchmaker_user_lifecycle%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_refl_end TIMESTAMPTZ;
  v_pool_resume TIMESTAMPTZ;
  v_day INT;
  v_days_until_pool INT;
BEGIN
  SELECT * INTO v_row FROM public.matchmaker_user_lifecycle
  WHERE user_id = p_user_id AND entered_pool_at IS NULL;

  IF v_row.user_id IS NULL THEN
    RETURN jsonb_build_object('phase', 'none');
  END IF;

  v_refl_end := v_row.reflection_started_at + INTERVAL '3 days';
  v_pool_resume := v_row.reflection_started_at + INTERVAL '6 days';

  IF v_row.healing_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'phase', 'reentry',
      'reflection_started_at', v_row.reflection_started_at,
      'source_connection_id', v_row.source_connection_id
    );
  END IF;

  IF v_now >= v_refl_end THEN
    IF v_row.healing_started_at IS NULL THEN
      UPDATE public.matchmaker_user_lifecycle
      SET healing_started_at = v_refl_end
      WHERE user_id = p_user_id AND healing_started_at IS NULL;
      v_row.healing_started_at := v_refl_end;
    END IF;

    v_day := LEAST(3, GREATEST(1, EXTRACT(DAY FROM (v_now - v_row.healing_started_at))::INT + 1));
    RETURN jsonb_build_object(
      'phase', 'healing',
      'healing_day', v_day,
      'reflection_started_at', v_row.reflection_started_at,
      'source_connection_id', v_row.source_connection_id
    );
  END IF;

  v_day := LEAST(3, GREATEST(1, EXTRACT(DAY FROM (v_now - v_row.reflection_started_at))::INT + 1));
  v_days_until_pool := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_pool_resume - v_now)) / 86400)::INT);

  RETURN jsonb_build_object(
    'phase', 'reflection',
    'reflection_day', v_day,
    'days_until_pool', v_days_until_pool,
    'reflection_started_at', v_row.reflection_started_at,
    'source_connection_id', v_row.source_connection_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_start_user_lifecycle(p_user_id UUID, p_connection_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.matchmaker_user_lifecycle (user_id, reflection_started_at, source_connection_id)
  VALUES (p_user_id, NOW(), p_connection_id)
  ON CONFLICT (user_id) DO UPDATE SET
    reflection_started_at = EXCLUDED.reflection_started_at,
    healing_started_at = NULL,
    healing_completed_at = NULL,
    entered_pool_at = NULL,
    source_connection_id = EXCLUDED.source_connection_id,
    created_at = NOW();

  INSERT INTO public.matchmaker_reflection_responses (connection_id, user_id)
  VALUES (p_connection_id, p_user_id)
  ON CONFLICT (connection_id, user_id) DO NOTHING;
END;
$$;

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
  v_lifecycle JSONB;
  v_cooldown_reason TEXT;
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

  SELECT cooldown_until, reason INTO v_suspension_until, v_cooldown_reason
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

  SELECT cooldown_until, reason INTO v_cooldown_until, v_cooldown_reason
  FROM public.matchmaker_cooldowns
  WHERE user_id = v_user
    AND cooldown_until > NOW()
    AND reason <> 'contact_sharing';

  IF v_cooldown_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'gate', 'cooldown',
      'cooldown_until', v_cooldown_until,
      'cooldown_reason', v_cooldown_reason
    );
  END IF;

  v_lifecycle := public.matchmaker_resolve_lifecycle_phase(v_user);
  IF (v_lifecycle->>'phase') = 'reflection' THEN
    RETURN jsonb_build_object('gate', 'reflection') || v_lifecycle;
  END IF;
  IF (v_lifecycle->>'phase') = 'healing' THEN
    RETURN jsonb_build_object('gate', 'healing') || v_lifecycle;
  END IF;
  IF (v_lifecycle->>'phase') = 'reentry' THEN
    RETURN jsonb_build_object('gate', 'reentry') || v_lifecycle;
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

CREATE OR REPLACE FUNCTION public.matchmaker_save_reflection_period(
  p_text TEXT,
  p_skip BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn UUID;
BEGIN
  SELECT source_connection_id INTO v_conn
  FROM public.matchmaker_user_lifecycle
  WHERE user_id = v_user AND entered_pool_at IS NULL;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'no_active_lifecycle';
  END IF;

  UPDATE public.matchmaker_reflection_responses
  SET reflection_period_text = CASE WHEN p_skip THEN reflection_period_text ELSE p_text END
  WHERE connection_id = v_conn AND user_id = v_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_save_healing_answers(
  p_answers JSONB,
  p_complete BOOLEAN DEFAULT false,
  p_skip_all BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn UUID;
BEGIN
  SELECT source_connection_id INTO v_conn
  FROM public.matchmaker_user_lifecycle
  WHERE user_id = v_user AND entered_pool_at IS NULL;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'no_active_lifecycle';
  END IF;

  UPDATE public.matchmaker_reflection_responses
  SET healing_answers = COALESCE(healing_answers, '{}'::jsonb) || COALESCE(p_answers, '{}'::jsonb)
  WHERE connection_id = v_conn AND user_id = v_user;

  IF p_complete OR p_skip_all THEN
    UPDATE public.matchmaker_user_lifecycle
    SET healing_completed_at = NOW()
    WHERE user_id = v_user AND entered_pool_at IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_enter_matchmaker_pool()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  UPDATE public.matchmaker_user_lifecycle
  SET entered_pool_at = NOW()
  WHERE user_id = v_user AND entered_pool_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_connection_history()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rows JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.ended_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      mc.id AS connection_id,
      mc.ended_at,
      mc.connected_at,
      mc.first_plan_created_at,
      CASE
        WHEN mc.user_a_id = v_user THEN mc.user_b_id
        ELSE mc.user_a_id
      END AS partner_id,
      p.display_name AS partner_name,
      p.avatar_url AS partner_avatar_url,
      p.primary_photo_url,
      CASE
        WHEN mc.first_plan_created_at IS NOT NULL THEN 'plan created'
        ELSE 'ended'
      END AS outcome_label
    FROM public.matchmaker_connections mc
    INNER JOIN public.profiles p ON p.user_id = CASE
      WHEN mc.user_a_id = v_user THEN mc.user_b_id
      ELSE mc.user_a_id
    END
    WHERE mc.status = 'ended'
      AND (mc.user_a_id = v_user OR mc.user_b_id = v_user)
      AND mc.ended_at IS NOT NULL
  ) t;

  RETURN v_rows;
END;
$$;

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

  PERFORM public.matchmaker_start_user_lifecycle(v_conn.user_a_id, p_connection_id);
  PERFORM public.matchmaker_start_user_lifecycle(v_conn.user_b_id, p_connection_id);

  PERFORM public.create_notification(
    v_partner,
    'matchmaker_connection_ended',
    'Connection ended',
    'This connection has ended.',
    jsonb_build_object('href', '/matchmaker'),
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
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_pause_expired_subscriptions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_partner UUID;
BEGIN
  FOR r IN
    SELECT mc.id, mc.user_a_id, mc.user_b_id
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'active'
      AND (
        NOT public.matchmaker_user_has_gold_access(mc.user_a_id)
        OR NOT public.matchmaker_user_has_gold_access(mc.user_b_id)
      )
  LOOP
    UPDATE public.matchmaker_connections
    SET status = 'paused', paused_at = COALESCE(paused_at, NOW())
    WHERE id = r.id AND status = 'active';
  END LOOP;

  FOR r IN
    SELECT mc.id, mc.user_a_id, mc.user_b_id, mc.paused_at
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'paused'
      AND mc.paused_at IS NOT NULL
      AND mc.paused_at < NOW() - INTERVAL '14 days'
      AND (
        NOT public.matchmaker_user_has_gold_access(mc.user_a_id)
        OR NOT public.matchmaker_user_has_gold_access(mc.user_b_id)
      )
  LOOP
    UPDATE public.matchmaker_connections
    SET status = 'ended', ended_at = NOW(), end_reason = 'subscription_lapse', ended_by = NULL
    WHERE id = r.id AND status = 'paused';

    PERFORM public.matchmaker_start_user_lifecycle(r.user_a_id, r.id);
    PERFORM public.matchmaker_start_user_lifecycle(r.user_b_id, r.id);

    PERFORM public.create_notification(
      r.user_a_id,
      'matchmaker_connection_ended',
      'Connection ended',
      'This connection has ended.',
      jsonb_build_object('href', '/matchmaker'),
      'medium',
      'matchmaker_lapse_ended:' || r.id::text || ':a'
    );

    PERFORM public.create_notification(
      r.user_b_id,
      'matchmaker_connection_ended',
      'Connection ended',
      'This connection has ended.',
      jsonb_build_object('href', '/matchmaker'),
      'medium',
      'matchmaker_lapse_ended:' || r.id::text || ':b'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaker_resolve_lifecycle_phase(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_save_reflection_period(TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_save_healing_answers(JSONB, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_enter_matchmaker_pool() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_connection_history() TO authenticated, service_role;

-- Pool visibility: hide users who opted out
CREATE OR REPLACE FUNCTION public.matchmaker_profile_in_pool(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pool_visible FROM public.matchmaker_intents WHERE user_id = p_user_id AND is_active),
    false
  );
$$;
