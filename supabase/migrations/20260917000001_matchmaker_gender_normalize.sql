-- Normalize profile gender for MatchMaker pool (Woman/Man → female/male) + defensive RPC matching.

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

-- Backfill legacy onboarding labels already in production.
UPDATE public.profiles
SET gender = public.normalize_profile_gender(gender)
WHERE gender IS NOT NULL
  AND gender IS DISTINCT FROM public.normalize_profile_gender(gender);

UPDATE public.profiles p
SET preferences = jsonb_set(
  COALESCE(p.preferences, '{}'::jsonb),
  '{self_gender}',
  to_jsonb(public.normalize_profile_gender(p.preferences->>'self_gender')),
  true
)
WHERE p.preferences ? 'self_gender'
  AND public.normalize_profile_gender(p.preferences->>'self_gender') IS NOT NULL
  AND (p.preferences->>'self_gender') IS DISTINCT FROM public.normalize_profile_gender(p.preferences->>'self_gender');

CREATE OR REPLACE FUNCTION public.matchmaker_profile_is_pool_eligible(p profiles)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.matchmaker_pool_gender(p.gender) IS NOT NULL
    AND COALESCE(NULLIF(btrim(p.display_name), ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(btrim(p.bio), ''), NULL) IS NOT NULL
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND COALESCE(array_length(p.photo_urls, 1), 0) > 0
    AND jsonb_typeof(p.preferences->'interests') = 'array'
    AND jsonb_array_length(p.preferences->'interests') > 0;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_pool(p_limit INT DEFAULT 12)
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
  v_rows JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_viewer FROM public.profiles WHERE user_id = v_user;

  v_viewer_pool_gender := public.matchmaker_pool_gender(v_viewer.gender);

  IF v_viewer_pool_gender = 'female' THEN
    v_target_gender := 'male';
  ELSIF v_viewer_pool_gender = 'male' THEN
    v_target_gender := 'female';
  ELSE
    RETURN '[]'::jsonb;
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
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  ) t;

  RETURN v_rows;
END;
$$;

NOTIFY pgrst, 'reload schema';
