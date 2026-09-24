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

-- matchmaker_get_pool is defined in later migrations (3-param JSONB envelope version).
