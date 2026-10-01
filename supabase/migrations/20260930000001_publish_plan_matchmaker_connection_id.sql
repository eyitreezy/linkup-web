-- Persist matchmaker_connection_id on plans when publish_plan payload includes it.
-- The core publish_plan RPC lives outside this repo; wrap it so web MatchMaker plan creation
-- links plans to connections (first_plan_created_at trigger, shared activity, etc.).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'publish_plan'
      AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'publish_plan_before_matchmaker_link'
  ) THEN
    ALTER FUNCTION public.publish_plan(jsonb) RENAME TO publish_plan_before_matchmaker_link;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.publish_plan(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_mm_id uuid;
  v_user uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_mm_id := NULLIF(TRIM(payload->>'matchmaker_connection_id'), '')::uuid;

  IF v_mm_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.matchmaker_connections mc
      WHERE mc.id = v_mm_id
        AND mc.status IN ('active', 'paused')
        AND (mc.user_a_id = v_user OR mc.user_b_id = v_user)
    ) THEN
      RAISE EXCEPTION 'invalid matchmaker connection';
    END IF;
  END IF;

  v_plan_id := public.publish_plan_before_matchmaker_link(payload);

  IF v_mm_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    UPDATE public.plans
    SET matchmaker_connection_id = v_mm_id
    WHERE id = v_plan_id
      AND creator_id = v_user;
  END IF;

  RETURN v_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_plan(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_plan(jsonb) TO authenticated;
