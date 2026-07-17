/**
 * Meet type approval flow — RLS + SECURITY DEFINER insert RPC.
 *
 * Direct client INSERT often fails when policies require is_active=true (migration 01)
 * or when INSERT…RETURNING hits SELECT RLS. The RPC runs as definer and validates auth.uid().
 */
ALTER TABLE public.meet_types
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meet_types_approval_status_check'
      AND conrelid = 'public.meet_types'::regclass
  ) THEN
    ALTER TABLE public.meet_types
      ADD CONSTRAINT meet_types_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

COMMENT ON COLUMN public.meet_types.approval_status IS
  'User custom types start pending; catalog rows default to approved.';

-- User submissions: pending + inactive until admin approves.
DROP POLICY IF EXISTS meet_types_insert_user ON public.meet_types;
CREATE POLICY meet_types_insert_user ON public.meet_types
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed IS FALSE
    AND is_active IS FALSE
    AND approval_status = 'pending'
  );

-- Creator can read own rows in any approval state (pending / approved / rejected).
DROP POLICY IF EXISTS meet_types_select ON public.meet_types;
CREATE POLICY meet_types_select ON public.meet_types
  FOR SELECT
  USING (
    is_active = true
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.insert_user_meet_type(
  p_name TEXT,
  p_default_duration_minutes INT DEFAULT 120,
  p_icon TEXT DEFAULT 'sparkles-outline'
)
RETURNS public.meet_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_trimmed TEXT;
  v_base TEXT;
  v_slug TEXT;
  v_row public.meet_types;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Admins use the admin catalog to manage meet types';
  END IF;

  v_trimmed := trim(p_name);
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meet_types mt
    WHERE mt.created_by = v_uid
      AND mt.approval_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a meet type awaiting approval';
  END IF;

  v_base := trim(both '-' FROM regexp_replace(lower(v_trimmed), '[^a-z0-9]+', '-', 'g'));
  IF v_base = '' THEN
    v_base := 'meetup';
  END IF;
  v_base := left(v_base, 48);

  v_slug := 'u-' || v_base || '-'
    || to_char(floor(extract(epoch FROM clock_timestamp()) * 1000), 'FM999999999999999')
    || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.meet_types (
    name,
    slug,
    default_duration_minutes,
    allows_escrow,
    allowed_patterns,
    default_pattern,
    is_restricted,
    supports_mood,
    icon,
    sort_order,
    is_active,
    is_admin_managed,
    created_by,
    approval_status
  ) VALUES (
    v_trimmed,
    v_slug,
    COALESCE(p_default_duration_minutes, 120),
    true,
    ARRAY['A', 'B', 'C']::text[],
    'A',
    false,
    false,
    COALESCE(nullif(trim(p_icon), ''), 'sparkles-outline'),
    9000,
    false,
    false,
    v_uid,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_user_meet_type(TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_user_meet_type(TEXT, INT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
