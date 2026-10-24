-- Resume paused MatchMaker connections when both members have Gold access again.

CREATE OR REPLACE FUNCTION public.matchmaker_try_resume_connection(p_connection_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_conn
  FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_conn.status <> 'paused' THEN
    RETURN false;
  END IF;

  IF NOT public.matchmaker_user_has_gold_access(v_conn.user_a_id)
     OR NOT public.matchmaker_user_has_gold_access(v_conn.user_b_id) THEN
    RETURN false;
  END IF;

  UPDATE public.matchmaker_connections
  SET status = 'active', paused_at = NULL
  WHERE id = p_connection_id AND status = 'paused';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_try_resume_connection(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_try_resume_connection(UUID) TO authenticated, service_role;
