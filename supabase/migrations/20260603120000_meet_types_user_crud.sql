/**
 * Web meet-type management: users can update/archive their own custom types.
 * Catalog rows (created_by IS NULL) remain read-only for clients.
 */
DROP POLICY IF EXISTS meet_types_select ON public.meet_types;
CREATE POLICY meet_types_select ON public.meet_types
  FOR SELECT
  USING (
    is_active = true
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS meet_types_update_own ON public.meet_types;
CREATE POLICY meet_types_update_own ON public.meet_types
  FOR UPDATE TO authenticated
  USING (created_by IS NOT NULL AND created_by = auth.uid())
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());
