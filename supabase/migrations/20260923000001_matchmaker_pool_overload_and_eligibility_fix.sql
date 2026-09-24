-- Resolve matchmaker_get_pool overload collision and relax pool eligibility for development.
-- Canonical 3-param pool RPC body matches 20260921000002_matchmaker_pool_filters.sql.
-- Self-contained: ensures gender helpers exist even if 20260917000001 was not applied.

CREATE OR REPLACE FUNCTION public.normalize_profile_gender(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN lower(btrim(raw)) IN ('woman', 'women', 'female') THEN 'female'
    WHEN lower(btrim(raw)) IN ('man', 'men', 'male') THEN 'male'
    WHEN lower(replace(btrim(raw), '-', '_')) IN ('non_binary', 'nonbinary') THEN 'non_binary'
    WHEN lower(replace(btrim(raw), ' ', '_')) IN ('prefer_not_to_say', 'prefer_not') THEN 'prefer_not_to_say'
    WHEN lower(btrim(raw)) IN ('female', 'male', 'non_binary', 'prefer_not_to_say') THEN lower(btrim(raw))
    ELSE lower(btrim(raw))
  END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_pool_gender(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE public.normalize_profile_gender(raw)
    WHEN 'female' THEN 'female'
    WHEN 'male' THEN 'male'
    ELSE NULL
  END;
$$;

DROP FUNCTION IF EXISTS public.matchmaker_get_pool(INT);
DROP FUNCTION IF EXISTS public.matchmaker_get_pool(INT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.matchmaker_get_pool(
  p_limit INT DEFAULT 12,
  p_max_distance_km INT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'best_match'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_viewer public.profiles%ROWTYPE;
  v_viewer_pool_gender TEXT;
  v_target_gender TEXT;
  v_dealbreakers JSONB;
  v_viewer_faith TEXT;
  v_viewer_family_goals TEXT;
  v_max_distance_km INT;
  v_age_min INT;
  v_age_max INT;
  v_has_location_dealbreaker BOOLEAN;
  v_has_any_dealbreaker BOOLEAN;
  v_profiles JSONB;
  v_has_without_dealbreakers BOOLEAN;
  v_has_without_location BOOLEAN;
  v_sort_by TEXT := COALESCE(NULLIF(trim(p_sort_by), ''), 'best_match');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_sort_by NOT IN ('best_match', 'recently_joined') THEN
    v_sort_by := 'best_match';
  END IF;

  SELECT * INTO v_viewer FROM public.profiles WHERE user_id = v_user;

  v_viewer_pool_gender := public.matchmaker_pool_gender(v_viewer.gender);

  IF v_viewer_pool_gender IS NULL THEN
    RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'gender_not_set');
  END IF;

  IF v_viewer_pool_gender = 'female' THEN
    v_target_gender := 'male';
  ELSE
    v_target_gender := 'female';
  END IF;

  SELECT mv.dealbreakers, mv.faith, mv.family_goals
  INTO v_dealbreakers, v_viewer_faith, v_viewer_family_goals
  FROM public.matchmaker_values mv
  WHERE mv.user_id = v_user;

  v_dealbreakers := COALESCE(v_dealbreakers, '{}'::jsonb);
  v_max_distance_km := NULLIF((v_dealbreakers->>'max_distance_km')::INT, 0);
  v_age_min := NULLIF((v_dealbreakers->>'age_min')::INT, 0);
  v_age_max := NULLIF((v_dealbreakers->>'age_max')::INT, 0);
  v_has_location_dealbreaker := v_max_distance_km IS NOT NULL;
  v_has_any_dealbreaker :=
    COALESCE((v_dealbreakers->>'faith_alignment')::BOOLEAN, FALSE)
    OR COALESCE((v_dealbreakers->>'family_goals_alignment')::BOOLEAN, FALSE)
    OR v_has_location_dealbreaker
    OR v_age_min IS NOT NULL
    OR v_age_max IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_profiles
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
      p.verified_badge,
      public.matchmaker_haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude) AS distance_km
    FROM public.profiles p
    INNER JOIN public.users u ON u.id = p.user_id
    INNER JOIN public.matchmaker_intents mi_sort ON mi_sort.user_id = p.user_id AND mi_sort.is_active
    LEFT JOIN public.matchmaker_values cv ON cv.user_id = p.user_id
    WHERE p.user_id <> v_user
      AND public.matchmaker_pool_gender(p.gender) = v_target_gender
      AND u.verification_status = 'verified'
      AND public.matchmaker_user_has_gold_access(p.user_id)
      AND public.matchmaker_profile_is_pool_eligible(p)
      AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_exclusions me
        WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
           OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE mc.status IN ('active', 'paused')
          AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_cooldowns cd
        WHERE cd.user_id = p.user_id AND cd.cooldown_until > NOW()
      )
      AND (
        NOT COALESCE((v_dealbreakers->>'faith_alignment')::BOOLEAN, FALSE)
        OR (
          v_viewer_faith IS NOT NULL
          AND cv.faith IS NOT DISTINCT FROM v_viewer_faith
        )
      )
      AND (
        NOT COALESCE((v_dealbreakers->>'family_goals_alignment')::BOOLEAN, FALSE)
        OR (
          v_viewer_family_goals IS NOT NULL
          AND cv.family_goals = v_viewer_family_goals
        )
      )
      AND (
        NOT v_has_location_dealbreaker
        OR (
          p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND v_viewer.latitude IS NOT NULL
          AND v_viewer.longitude IS NOT NULL
          AND public.matchmaker_haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
            <= COALESCE(v_max_distance_km, 50)
        )
      )
      AND (
        (v_age_min IS NULL AND v_age_max IS NULL)
        OR (
          p.birth_date IS NOT NULL
          AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT >= COALESCE(v_age_min, 18)
          AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT <= COALESCE(v_age_max, 99)
        )
      )
      AND (
        p_max_distance_km IS NULL
        OR (
          p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND v_viewer.latitude IS NOT NULL
          AND v_viewer.longitude IS NOT NULL
          AND public.matchmaker_haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
            <= p_max_distance_km
        )
      )
    ORDER BY
      CASE WHEN v_sort_by = 'recently_joined' THEN mi_sort.declared_at END DESC NULLS LAST,
      p.updated_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  ) t;

  IF jsonb_array_length(v_profiles) > 0 THEN
    RETURN jsonb_build_object('profiles', v_profiles, 'empty_reason', NULL);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id <> v_user
      AND public.matchmaker_pool_gender(p.gender) = v_target_gender
      AND u.verification_status = 'verified'
      AND public.matchmaker_user_has_gold_access(p.user_id)
      AND public.matchmaker_profile_is_pool_eligible(p)
      AND EXISTS (SELECT 1 FROM public.matchmaker_intents mi WHERE mi.user_id = p.user_id AND mi.is_active)
      AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_exclusions me
        WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
           OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE mc.status IN ('active', 'paused')
          AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_cooldowns cd
        WHERE cd.user_id = p.user_id AND cd.cooldown_until > NOW()
      )
    LIMIT 1
  ) INTO v_has_without_dealbreakers;

  IF NOT v_has_without_dealbreakers THEN
    RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'genuinely_empty');
  END IF;

  IF v_has_location_dealbreaker OR p_max_distance_km IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      INNER JOIN public.users u ON u.id = p.user_id
      LEFT JOIN public.matchmaker_values cv ON cv.user_id = p.user_id
      WHERE p.user_id <> v_user
        AND public.matchmaker_pool_gender(p.gender) = v_target_gender
        AND u.verification_status = 'verified'
        AND public.matchmaker_user_has_gold_access(p.user_id)
        AND public.matchmaker_profile_is_pool_eligible(p)
        AND EXISTS (SELECT 1 FROM public.matchmaker_intents mi WHERE mi.user_id = p.user_id AND mi.is_active)
        AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.matchmaker_exclusions me
          WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
             OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.matchmaker_connections mc
          WHERE mc.status IN ('active', 'paused')
            AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.matchmaker_cooldowns cd
          WHERE cd.user_id = p.user_id AND cd.cooldown_until > NOW()
        )
        AND (
          NOT COALESCE((v_dealbreakers->>'faith_alignment')::BOOLEAN, FALSE)
          OR (
            v_viewer_faith IS NOT NULL
            AND cv.faith IS NOT DISTINCT FROM v_viewer_faith
          )
        )
        AND (
          NOT COALESCE((v_dealbreakers->>'family_goals_alignment')::BOOLEAN, FALSE)
          OR (
            v_viewer_family_goals IS NOT NULL
            AND cv.family_goals = v_viewer_family_goals
          )
        )
        AND (
          (v_age_min IS NULL AND v_age_max IS NULL)
          OR (
            p.birth_date IS NOT NULL
            AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT >= COALESCE(v_age_min, 18)
            AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT <= COALESCE(v_age_max, 99)
          )
        )
      LIMIT 1
    ) INTO v_has_without_location;

    IF v_has_without_location THEN
      RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'location_narrow');
    END IF;
  END IF;

  IF v_has_any_dealbreaker THEN
    RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'dealbreakers_strict');
  END IF;

  RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'genuinely_empty');
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_get_pool(INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_pool(INT, INT, TEXT) TO authenticated, service_role;

-- Development: relax pool eligibility (re-enable strict checks before production).
CREATE OR REPLACE FUNCTION public.matchmaker_profile_is_pool_eligible(p profiles)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.matchmaker_pool_gender(p.gender::text) IS NOT NULL
    AND COALESCE(NULLIF(btrim(p.display_name), ''), NULL) IS NOT NULL
    -- AND COALESCE(NULLIF(btrim(p.bio), ''), NULL) IS NOT NULL
    -- AND p.latitude IS NOT NULL
    -- AND p.longitude IS NOT NULL
    -- AND COALESCE(array_length(p.photo_urls, 1), 0) > 0
    -- AND jsonb_typeof(p.preferences->'interests') = 'array'
    -- AND jsonb_array_length(p.preferences->'interests') > 0
    ;
$$;

NOTIFY pgrst, 'reload schema';
