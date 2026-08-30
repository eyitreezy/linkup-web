-- Creator plan detail access bypasses restrictive RLS (cancelled/completed/archived history).

CREATE OR REPLACE FUNCTION public.get_creator_plan_for_detail(p_plan_id UUID)
RETURNS public.plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('row_security', 'off', true);

  SELECT * INTO _plan
  FROM public.plans
  WHERE id = p_plan_id
    AND creator_id = auth.uid();

  RETURN _plan;
END;
$$;

REVOKE ALL ON FUNCTION public.get_creator_plan_for_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_plan_for_detail(UUID) TO authenticated, service_role;
