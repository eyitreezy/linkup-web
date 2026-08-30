-- Notification dismiss + creator read access for cancelled/completed plan history.

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS plans_select_own_creator ON public.plans;
CREATE POLICY plans_select_own_creator
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- Matched guests may still reference cancelled plans via offers / join requests / invitations.
DROP POLICY IF EXISTS plans_select_participant_cancelled ON public.plans;
CREATE POLICY plans_select_participant_cancelled
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (
    status IN ('cancelled', 'completed')
    AND (
      EXISTS (
        SELECT 1
        FROM public.plan_offers po
        WHERE po.plan_id = plans.id
          AND po.bidder_id = auth.uid()
          AND po.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1
        FROM public.plan_join_requests pjr
        WHERE pjr.plan_id = plans.id
          AND pjr.requester_id = auth.uid()
          AND pjr.status = 'approved'
      )
      OR EXISTS (
        SELECT 1
        FROM public.plan_invitations pi
        WHERE pi.plan_id = plans.id
          AND pi.invitee_user_id = auth.uid()
          AND pi.status = 'accepted'
      )
    )
  );
