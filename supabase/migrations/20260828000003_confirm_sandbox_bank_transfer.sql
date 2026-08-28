-- Test mode: Flutterwave Mock Bank VAs never receive real transfers or webhooks.
-- This RPC marks the session funded and completes the escrow leg after the user confirms.

CREATE OR REPLACE FUNCTION public.confirm_sandbox_bank_transfer(
  p_escrow_id UUID,
  p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _session public.virtual_account_sessions%ROWTYPE;
  _escrow public.escrow_transactions%ROWTYPE;
  _leg TEXT;
  _is_group_split_row BOOLEAN;
  _host_share INT;
  _guest_share INT;
BEGIN
  IF _user_id IS NULL OR p_escrow_id IS NULL OR p_session_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO _session
  FROM public.virtual_account_sessions
  WHERE id = p_session_id
    AND escrow_id = p_escrow_id
    AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF lower(trim(COALESCE(_session.bank_name, ''))) NOT LIKE '%mock%'
    AND lower(trim(COALESCE(_session.bank_name, ''))) NOT LIKE '%test%'
    AND lower(trim(COALESCE(_session.bank_name, ''))) <> 'virtual bank' THEN
    RAISE EXCEPTION 'sandbox_only';
  END IF;

  IF _session.status = 'expired'
    OR (_session.expires_at IS NOT NULL AND _session.expires_at < NOW()) THEN
    RAISE EXCEPTION 'session_expired';
  END IF;

  IF _session.status <> 'funded' THEN
    UPDATE public.virtual_account_sessions
    SET status = 'funded'
    WHERE id = p_session_id;
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
    RAISE EXCEPTION 'not_escrow_party';
  END IF;

  IF _escrow.status IN ('funded', 'active', 'released')
    OR public.escrow_funding_complete(_escrow) THEN
    RETURN TRUE;
  END IF;

  _leg := COALESCE(_escrow.metadata->>'leg', '');
  _is_group_split_row := _leg IN ('guest_slot', 'host_close');
  _host_share := GREATEST(0, COALESCE(_escrow.host_share_cents, 0));
  _guest_share := GREATEST(0, COALESCE(_escrow.guest_share_cents, 0));

  IF _is_group_split_row THEN
    UPDATE public.escrow_transactions
    SET
      status = 'funded',
      funded_at = COALESCE(funded_at, NOW()),
      guest_funded_at = CASE
        WHEN _guest_share > 0 AND guest_id = _user_id THEN COALESCE(guest_funded_at, NOW())
        ELSE guest_funded_at
      END,
      host_funded_at = CASE
        WHEN _host_share > 0 AND host_id = _user_id THEN COALESCE(host_funded_at, NOW())
        ELSE host_funded_at
      END,
      payment_method = COALESCE(payment_method, 'bank_transfer'),
      updated_at = NOW()
    WHERE id = p_escrow_id
      AND status = 'pending_funding';
  ELSIF _escrow.escrow_pattern = 'B' THEN
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

  IF _escrow.plan_id IS NOT NULL THEN
    PERFORM public.check_plan_escrow_fully_funded(_escrow.plan_id);
  END IF;

  SELECT * INTO _escrow FROM public.escrow_transactions WHERE id = p_escrow_id;

  RETURN _escrow.status IN ('funded', 'active', 'released')
    OR public.escrow_funding_complete(_escrow);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_sandbox_bank_transfer(UUID, UUID) TO authenticated;
