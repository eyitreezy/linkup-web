-- Fix count_group_plan_funded_members: FOR loop variable must be escrow_transactions%ROWTYPE,
-- not RECORD, so escrow_funding_complete() accepts it.

CREATE OR REPLACE FUNCTION public.count_group_plan_funded_members(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _count INTEGER := 0;
  _guest public.escrow_transactions%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.guest_id IS NULL
      AND e.status NOT IN ('cancelled', 'refunded')
      AND (e.payer_id = _plan.creator_id OR e.host_id = _plan.creator_id)
      AND public.escrow_funding_complete(e)
  ) THEN
    _count := _count + 1;
  END IF;

  FOR _guest IN
    SELECT DISTINCT ON (e.guest_id) e.*
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.guest_id IS NOT NULL
      AND e.status NOT IN ('cancelled', 'refunded')
    ORDER BY e.guest_id, e.created_at ASC
  LOOP
    IF public.escrow_funding_complete(_guest) THEN
      _count := _count + 1;
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_group_plan_funded_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_group_plan_funded_members(UUID) TO anon;
