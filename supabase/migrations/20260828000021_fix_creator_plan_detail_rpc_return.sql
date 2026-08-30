-- PostgREST deserializes NULL composite plans rows as an object of null fields.
-- SETOF returns zero rows instead, so clients can reliably detect "no access".

DROP FUNCTION IF EXISTS public.get_creator_plan_for_detail(UUID);

CREATE FUNCTION public.get_creator_plan_for_detail(p_plan_id UUID)
RETURNS SETOF public.plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT p.*
  FROM public.plans p
  WHERE p.id = p_plan_id
    AND p.creator_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_creator_plan_for_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_plan_for_detail(UUID) TO authenticated, service_role;
