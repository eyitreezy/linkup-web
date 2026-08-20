/**
 * Group chat open/create from meetup details.
 *
 * Hosts must read a group conversation before they are in group_chat_members
 * (preload lookup and insert without relying on RETURNING through member-only select).
 * Re-assert conv_insert for group plan hosts (idempotent with mobile migration).
 */

DROP POLICY IF EXISTS conv_select ON public.conversations;
CREATE POLICY conv_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR public.auth_uid_is_active_group_member(id)
    OR (
      is_group_chat = true
      AND (
        created_by = auth.uid()
        OR (
          plan_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.plans p
            WHERE p.id = conversations.plan_id
              AND p.creator_id = auth.uid()
              AND p.is_group_plan = true
          )
        )
      )
    )
    OR public.is_admin(auth.uid())
  );

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
