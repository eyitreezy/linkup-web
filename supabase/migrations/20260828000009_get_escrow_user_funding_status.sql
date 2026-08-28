-- Authoritative escrow leg funding read for payment confirmation (bypasses RLS visibility gaps).

CREATE OR REPLACE FUNCTION public.get_escrow_user_funding_status(p_escrow_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _escrow public.escrow_transactions%ROWTYPE;
  _user_leg_funded BOOLEAN := false;
  _host_share BIGINT;
  _guest_share BIGINT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _escrow FROM public.escrow_transactions WHERE id = p_escrow_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF _escrow.host_id IS DISTINCT FROM _user_id
     AND _escrow.guest_id IS DISTINCT FROM _user_id
     AND _escrow.payer_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  _host_share := GREATEST(0, COALESCE(_escrow.host_share_cents, 0));
  _guest_share := GREATEST(0, COALESCE(_escrow.guest_share_cents, 0));

  IF _escrow.escrow_pattern = 'B' THEN
    IF _host_share <= 0 THEN
      _user_leg_funded := _escrow.guest_funded_at IS NOT NULL;
    ELSIF _guest_share <= 0 THEN
      _user_leg_funded := _escrow.host_funded_at IS NOT NULL;
    ELSIF _user_id = _escrow.host_id THEN
      _user_leg_funded := _escrow.host_funded_at IS NOT NULL;
    ELSIF _user_id = _escrow.guest_id OR _user_id = _escrow.payer_id THEN
      _user_leg_funded := _escrow.guest_funded_at IS NOT NULL;
    END IF;
  ELSE
    _user_leg_funded := _escrow.status NOT IN ('pending_funding', 'cancelled', 'refunded');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', _escrow.status,
    'host_funded_at', _escrow.host_funded_at,
    'guest_funded_at', _escrow.guest_funded_at,
    'user_leg_funded', _user_leg_funded,
    'escrow_funding_complete', public.escrow_funding_complete(_escrow),
    'checkout_initiated_by', _escrow.metadata->>'checkout_initiated_by'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_escrow_user_funding_status(UUID) TO authenticated;
