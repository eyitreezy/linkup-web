-- 60-day pool re-affirmation: gate, three actions, 7-day snooze, silence removal cron.

ALTER TABLE public.matchmaker_intents
  ADD COLUMN IF NOT EXISTS reaffirmation_snoozed_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reaffirmation_prompted_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.matchmaker_reaffirmation_anchor(p_user_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    mi.last_reaffirmed_at,
    (SELECT ul.entered_pool_at FROM public.matchmaker_user_lifecycle ul WHERE ul.user_id = p_user_id),
    mi.declared_at
  )
  FROM public.matchmaker_intents mi
  WHERE mi.user_id = p_user_id AND mi.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_reaffirmation_is_due(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.matchmaker_intents%ROWTYPE;
  v_anchor TIMESTAMPTZ;
  v_has_connection BOOLEAN;
BEGIN
  SELECT * INTO v_intent
  FROM public.matchmaker_intents
  WHERE user_id = p_user_id AND is_active = true;

  IF v_intent.user_id IS NULL OR NOT COALESCE(v_intent.pool_visible, true) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matchmaker_connections mc
    WHERE (mc.user_a_id = p_user_id OR mc.user_b_id = p_user_id)
      AND mc.status IN ('active', 'paused')
  ) INTO v_has_connection;

  IF v_has_connection THEN
    RETURN false;
  END IF;

  IF v_intent.reaffirmation_snoozed_until IS NOT NULL
     AND v_intent.reaffirmation_snoozed_until > NOW() THEN
    RETURN false;
  END IF;

  v_anchor := public.matchmaker_reaffirmation_anchor(p_user_id);
  IF v_anchor IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOW() >= v_anchor + INTERVAL '60 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_touch_reaffirmation_prompt(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matchmaker_intents
  SET reaffirmation_prompted_at = COALESCE(reaffirmation_prompted_at, NOW())
  WHERE user_id = p_user_id
    AND is_active = true
    AND COALESCE(pool_visible, true) = true
    AND public.matchmaker_reaffirmation_is_due(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_reaffirmation_respond(p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_action TEXT := lower(trim(p_action));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_action NOT IN ('yes', 'snooze', 'leave') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  IF NOT public.matchmaker_reaffirmation_is_due(v_user)
     AND v_action <> 'leave' THEN
    RAISE EXCEPTION 'reaffirmation_not_due';
  END IF;

  IF v_action = 'yes' THEN
    UPDATE public.matchmaker_intents
    SET
      last_reaffirmed_at = NOW(),
      reaffirmation_snoozed_until = NULL,
      reaffirmation_prompted_at = NULL
    WHERE user_id = v_user AND is_active = true;
    RETURN jsonb_build_object('ok', true, 'action', 'yes');
  ELSIF v_action = 'snooze' THEN
    UPDATE public.matchmaker_intents
    SET
      reaffirmation_snoozed_until = NOW() + INTERVAL '7 days',
      reaffirmation_prompted_at = NULL
    WHERE user_id = v_user AND is_active = true;
    RETURN jsonb_build_object('ok', true, 'action', 'snooze');
  ELSE
    UPDATE public.matchmaker_intents
    SET
      pool_visible = false,
      reaffirmation_snoozed_until = NULL,
      reaffirmation_prompted_at = NULL
    WHERE user_id = v_user AND is_active = true;
    RETURN jsonb_build_object('ok', true, 'action', 'leave');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_process_reaffirmation_silence_removals()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INT := 0;
BEGIN
  FOR v_row IN
    SELECT mi.user_id
    FROM public.matchmaker_intents mi
    WHERE mi.is_active = true
      AND COALESCE(mi.pool_visible, true) = true
      AND mi.reaffirmation_prompted_at IS NOT NULL
      AND mi.reaffirmation_prompted_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE (mc.user_a_id = mi.user_id OR mc.user_b_id = mi.user_id)
          AND mc.status IN ('active', 'paused')
      )
  LOOP
    UPDATE public.matchmaker_intents
    SET pool_visible = false, reaffirmation_prompted_at = NULL
    WHERE user_id = v_row.user_id;

    PERFORM public.create_notification(
      v_row.user_id,
      'matchmaker_pool_removed',
      'Removed from MatchMaker pool',
      'You have been removed from the MatchMaker pool. You can return anytime.',
      jsonb_build_object('href', '/matchmaker/settings'),
      'medium',
      'matchmaker_reaffirm_silence:' || v_row.user_id::text
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
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

  UPDATE public.matchmaker_intents
  SET
    last_reaffirmed_at = NOW(),
    reaffirmation_snoozed_until = NULL,
    reaffirmation_prompted_at = NULL,
    pool_visible = true
  WHERE user_id = v_user AND is_active = true;
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

  IF public.matchmaker_reaffirmation_is_due(v_user) THEN
    PERFORM public.matchmaker_touch_reaffirmation_prompt(v_user);
    RETURN jsonb_build_object('gate', 'reaffirmation');
  END IF;

  RETURN jsonb_build_object('gate', 'open');
END;
$$;

SELECT cron.schedule(
  'matchmaker-reaffirmation-silence',
  '15 9 * * *',
  $$SELECT public.matchmaker_process_reaffirmation_silence_removals();$$
);

GRANT EXECUTE ON FUNCTION public.matchmaker_reaffirmation_respond(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_process_reaffirmation_silence_removals() TO service_role;

REVOKE ALL ON FUNCTION public.matchmaker_reaffirmation_anchor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_reaffirmation_is_due(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_touch_reaffirmation_prompt(UUID) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
