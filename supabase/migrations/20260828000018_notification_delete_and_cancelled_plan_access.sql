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

-- Participant access for cancelled/completed plans is defined in 000019 using a
-- SECURITY DEFINER helper to avoid RLS recursion with child plan_* tables.
