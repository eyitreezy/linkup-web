-- Bank transfer UI polls this RPC so funding detection works even when escrow RLS
-- hides updated columns from the payer, and when VA session is funded before escrow row syncs.

CREATE OR REPLACE FUNCTION public.check_escrow_bank_transfer_funded(p_escrow_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _escrow public.escrow_transactions%ROWTYPE;
  _host_share BIGINT;
  _guest_share BIGINT;
BEGIN
  IF _user_id IS NULL OR p_escrow_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE id = p_escrow_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF _escrow.payer_id IS DISTINCT FROM _user_id
    AND _escrow.host_id IS DISTINCT FROM _user_id
    AND _escrow.guest_id IS DISTINCT FROM _user_id THEN
    RETURN FALSE;
  END IF;

  IF _escrow.status IN ('funded', 'active', 'released') THEN
    RETURN TRUE;
  END IF;

  IF public.escrow_funding_complete(_escrow) THEN
    RETURN TRUE;
  END IF;

  _host_share := GREATEST(0, COALESCE(_escrow.host_share_cents, 0));
  _guest_share := GREATEST(0, COALESCE(_escrow.guest_share_cents, 0));

  IF _escrow.escrow_pattern = 'B' THEN
    IF _guest_share <= 0 AND _escrow.host_funded_at IS NOT NULL
      AND (_escrow.host_id = _user_id OR _escrow.payer_id = _user_id) THEN
      RETURN TRUE;
    END IF;
    IF _host_share <= 0 AND _escrow.guest_funded_at IS NOT NULL
      AND (_escrow.guest_id = _user_id OR _escrow.payer_id = _user_id) THEN
      RETURN TRUE;
    END IF;
    IF _escrow.guest_id = _user_id AND _guest_share > 0 AND _escrow.guest_funded_at IS NOT NULL THEN
      RETURN TRUE;
    END IF;
    IF (_escrow.host_id = _user_id OR (_escrow.guest_id IS NULL AND _escrow.payer_id = _user_id))
      AND _host_share > 0 AND _escrow.host_funded_at IS NOT NULL THEN
      RETURN TRUE;
    END IF;
  ELSIF _escrow.payer_id = _user_id AND _escrow.status IS DISTINCT FROM 'pending_funding' THEN
    RETURN TRUE;
  END IF;

  IF to_regclass('public.virtual_account_sessions') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.virtual_account_sessions vas
      WHERE vas.escrow_id = p_escrow_id
        AND lower(COALESCE(vas.status::text, '')) IN ('funded', 'completed', 'paid', 'successful')
    ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_escrow_bank_transfer_funded(UUID) TO authenticated;

-- Realtime for VA session status (client fallback listener).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'virtual_account_sessions'
  ) THEN
    EXECUTE 'ALTER TABLE public.virtual_account_sessions REPLICA IDENTITY FULL';

    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'virtual_account_sessions'
      ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_account_sessions';
      END IF;
    END IF;
  END IF;
END $$;
