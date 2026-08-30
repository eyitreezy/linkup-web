-- Original group guest allocation = equal split at plan creation.
-- Must not recalculate as (remaining balance / remaining unpaid users) when members pay or accept.

CREATE OR REPLACE FUNCTION public.calculate_group_suggested_share(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _total BIGINT;
  _participants INT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.is_group_split_dynamic_plan(_plan) THEN
    RETURN NULL;
  END IF;

  _total := public.plan_total_cost_cents(_plan);
  IF _total <= 0 THEN
    RETURN 0;
  END IF;

  _participants := GREATEST(1, COALESCE(_plan.max_guests, 1)) + 1;
  RETURN CEIL(_total::NUMERIC / _participants)::BIGINT;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_group_suggested_share(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_group_suggested_share(UUID) TO authenticated, service_role;

-- Backfill plans that drifted to dynamic remaining-balance shares.
UPDATE public.plans p
SET
  current_suggested_share_cents = LEAST(
    GREATEST(COALESCE(public.calculate_group_suggested_share(p.id), 0), 0),
    2147483647
  )::INT,
  updated_at = NOW()
WHERE public.is_group_split_dynamic_plan(p)
  AND COALESCE(p.current_suggested_share_cents, 0) <> COALESCE(public.calculate_group_suggested_share(p.id), 0);
