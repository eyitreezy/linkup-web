-- Bank transfer: store gross checkout amounts on escrow legs and sync funding from VA sessions.

CREATE OR REPLACE FUNCTION public.ensure_escrow_bank_transfer_gross_amount(p_escrow_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _escrow public.escrow_transactions%ROWTYPE;
  _host_share INT;
  _guest_share INT;
  _gross INT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_not_found';
  END IF;

  IF _escrow.payer_id IS DISTINCT FROM _user_id
    AND _escrow.host_id IS DISTINCT FROM _user_id
    AND _escrow.guest_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'not_escrow_party';
  END IF;

  _host_share := GREATEST(0, COALESCE(_escrow.host_share_cents, 0));
  _guest_share := GREATEST(0, COALESCE(_escrow.guest_share_cents, 0));

  IF _escrow.escrow_pattern = 'B' THEN
    IF _guest_share > 0 AND _host_share <= 0 THEN
      _gross := public.gross_amount_cents(_guest_share)::INT;
    ELSIF _host_share > 0 AND _guest_share <= 0 THEN
      _gross := public.gross_amount_cents(_host_share)::INT;
    ELSIF _guest_share > 0 AND _host_share > 0 THEN
      IF _escrow.guest_id = _user_id OR (_escrow.payer_id = _user_id AND _escrow.guest_id IS NOT NULL) THEN
        _gross := public.gross_amount_cents(_guest_share)::INT;
      ELSE
        _gross := public.gross_amount_cents(_host_share)::INT;
      END IF;
    ELSE
      _gross := GREATEST(COALESCE(_escrow.amount_cents, 0), 0);
    END IF;
  ELSE
    _gross := GREATEST(COALESCE(_escrow.amount_cents, 0), 0);
  END IF;

  IF _gross > 0 AND COALESCE(_escrow.amount_cents, 0) <> _gross THEN
    UPDATE public.escrow_transactions
    SET amount_cents = _gross, updated_at = NOW()
    WHERE id = p_escrow_id;
  END IF;

  RETURN _gross;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_escrow_from_virtual_account(p_escrow_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _escrow public.escrow_transactions%ROWTYPE;
  _va_funded BOOLEAN := FALSE;
  _host_share INT;
  _guest_share INT;
BEGIN
  IF _user_id IS NULL OR p_escrow_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF _escrow.payer_id IS DISTINCT FROM _user_id
    AND _escrow.host_id IS DISTINCT FROM _user_id
    AND _escrow.guest_id IS DISTINCT FROM _user_id THEN
    RETURN FALSE;
  END IF;

  IF public.check_escrow_bank_transfer_funded(p_escrow_id) THEN
    RETURN TRUE;
  END IF;

  IF to_regclass('public.virtual_account_sessions') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.virtual_account_sessions vas
      WHERE vas.escrow_id = p_escrow_id
        AND lower(COALESCE(vas.status::text, '')) IN ('funded', 'completed', 'paid', 'successful')
    ) INTO _va_funded;
  END IF;

  IF NOT _va_funded THEN
    RETURN FALSE;
  END IF;

  _host_share := GREATEST(0, COALESCE(_escrow.host_share_cents, 0));
  _guest_share := GREATEST(0, COALESCE(_escrow.guest_share_cents, 0));

  IF _escrow.escrow_pattern = 'B' THEN
    IF _guest_share > 0 AND _host_share <= 0
      AND (_escrow.guest_id = _user_id OR _escrow.payer_id = _user_id)
      AND _escrow.guest_funded_at IS NULL THEN
      UPDATE public.escrow_transactions
      SET
        guest_funded_at = NOW(),
        payment_method = COALESCE(payment_method, 'bank_transfer'),
        updated_at = NOW()
      WHERE id = p_escrow_id;
    ELSIF _host_share > 0 AND _guest_share <= 0
      AND (_escrow.host_id = _user_id OR _escrow.payer_id = _user_id)
      AND _escrow.host_funded_at IS NULL THEN
      UPDATE public.escrow_transactions
      SET
        host_funded_at = NOW(),
        payment_method = COALESCE(payment_method, 'bank_transfer'),
        updated_at = NOW()
      WHERE id = p_escrow_id;
    ELSIF _guest_share > 0 AND _escrow.guest_id = _user_id AND _escrow.guest_funded_at IS NULL THEN
      UPDATE public.escrow_transactions
      SET
        guest_funded_at = NOW(),
        payment_method = COALESCE(payment_method, 'bank_transfer'),
        updated_at = NOW()
      WHERE id = p_escrow_id;
    ELSIF _host_share > 0 AND _escrow.host_id = _user_id AND _escrow.host_funded_at IS NULL THEN
      UPDATE public.escrow_transactions
      SET
        host_funded_at = NOW(),
        payment_method = COALESCE(payment_method, 'bank_transfer'),
        updated_at = NOW()
      WHERE id = p_escrow_id;
    END IF;
  ELSE
    UPDATE public.escrow_transactions
    SET
      status = 'funded',
      funded_at = COALESCE(funded_at, NOW()),
      payment_method = COALESCE(payment_method, 'bank_transfer'),
      updated_at = NOW()
    WHERE id = p_escrow_id
      AND status = 'pending_funding';
  END IF;

  SELECT * INTO _escrow FROM public.escrow_transactions WHERE id = p_escrow_id;

  IF public.escrow_funding_complete(_escrow)
    AND _escrow.status = 'pending_funding' THEN
    UPDATE public.escrow_transactions
    SET
      status = 'funded',
      funded_at = COALESCE(funded_at, NOW()),
      updated_at = NOW()
    WHERE id = p_escrow_id;
  END IF;

  RETURN public.check_escrow_bank_transfer_funded(p_escrow_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_escrow_bank_transfer_gross_amount(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_escrow_from_virtual_account(UUID) TO authenticated;

-- Backfill guest/host legs that stored budget cents in amount_cents instead of gross.
UPDATE public.escrow_transactions e
SET
  amount_cents = public.gross_amount_cents(e.guest_share_cents)::INT,
  updated_at = NOW()
WHERE e.escrow_pattern = 'B'
  AND e.guest_id IS NOT NULL
  AND COALESCE(e.host_share_cents, 0) = 0
  AND COALESCE(e.guest_share_cents, 0) > 0
  AND COALESCE(e.amount_cents, 0) <= COALESCE(e.guest_share_cents, 0);

UPDATE public.escrow_transactions e
SET
  amount_cents = public.gross_amount_cents(e.host_share_cents)::INT,
  updated_at = NOW()
WHERE e.escrow_pattern = 'B'
  AND e.guest_id IS NULL
  AND COALESCE(e.guest_share_cents, 0) = 0
  AND COALESCE(e.host_share_cents, 0) > 0
  AND COALESCE(e.amount_cents, 0) <= COALESCE(e.host_share_cents, 0);
