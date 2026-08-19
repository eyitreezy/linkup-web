-- Allow group plan hosts to create plan group conversations.
-- Without this, conv_insert only permits 1:1 rows (user_a / user_b), so
-- createGroupChat inserts fail with an RLS error on conversations.

DROP POLICY IF EXISTS conv_insert ON public.conversations;

CREATE POLICY conv_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      is_group_chat = false
      AND (user_a = auth.uid() OR user_b = auth.uid())
    )
    OR (
      is_group_chat = true
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.plans p
        WHERE p.id = conversations.plan_id
          AND p.creator_id = auth.uid()
          AND p.is_group_plan = true
      )
    )
    OR public.is_admin(auth.uid())
  );
