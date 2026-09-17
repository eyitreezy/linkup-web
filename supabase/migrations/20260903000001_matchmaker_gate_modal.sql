-- MatchMaker gate modal: gate state metadata + pool preview RPC.

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

CREATE OR REPLACE FUNCTION public.matchmaker_get_pool_preview(p_limit INT DEFAULT 6)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_viewer public.profiles%ROWTYPE;
  v_target_gender TEXT;
  v_rows JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_viewer FROM public.profiles WHERE user_id = v_user;

  IF v_viewer.gender = 'female' THEN
    v_target_gender := 'male';
  ELSIF v_viewer.gender = 'male' THEN
    v_target_gender := 'female';
  ELSE
    v_target_gender := NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      p.user_id,
      p.display_name,
      p.birth_date,
      p.location_label,
      p.photo_urls,
      p.primary_photo_url,
      p.avatar_url,
      p.preferences,
      p.communication_style,
      p.latitude,
      p.longitude,
      p.verified_badge
    FROM public.profiles p
    INNER JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id <> v_user
      AND (v_target_gender IS NULL OR p.gender = v_target_gender)
      AND p.gender IN ('male', 'female')
      AND u.verification_status = 'verified'
      AND public.matchmaker_user_has_gold_access(p.user_id)
      AND public.matchmaker_profile_is_pool_eligible(p)
      AND EXISTS (SELECT 1 FROM public.matchmaker_intents mi WHERE mi.user_id = p.user_id AND mi.is_active)
      AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE mc.status IN ('active', 'paused')
          AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
      )
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(p_limit, 12))
  ) t;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaker_get_pool_preview(INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
