-- Fix infinite recursion on plans SELECT policies introduced in 000018.
-- Child-table RLS (plan_offers, plan_join_requests, plan_invitations) references plans,
-- so plans policies must not query those tables directly under RLS.

CREATE OR REPLACE FUNCTION public.auth_uid_is_cancelled_plan_participant(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ok BOOLEAN;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.plan_offers po
    WHERE po.plan_id = p_plan_id
      AND po.bidder_id = auth.uid()
      AND po.status = 'accepted'
  )
  OR EXISTS (
    SELECT 1
    FROM public.plan_join_requests pjr
    WHERE pjr.plan_id = p_plan_id
      AND pjr.requester_id = auth.uid()
      AND pjr.status = 'approved'
  )
  OR EXISTS (
    SELECT 1
    FROM public.plan_invitations pi
    WHERE pi.plan_id = p_plan_id
      AND pi.invitee_user_id = auth.uid()
      AND pi.status = 'accepted'
  )
  INTO ok;

  RETURN COALESCE(ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_uid_is_cancelled_plan_participant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_is_cancelled_plan_participant(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS plans_select_participant_cancelled ON public.plans;
CREATE POLICY plans_select_participant_cancelled
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (
    status IN ('cancelled', 'completed')
    AND public.auth_uid_is_cancelled_plan_participant(id)
  );
