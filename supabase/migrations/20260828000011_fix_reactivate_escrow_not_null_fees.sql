-- Fix reactivation UPDATE: platform_fee_cents and goodwill_applied_cents are NOT NULL.

CREATE OR REPLACE FUNCTION public.ensure_group_guest_escrow_slot(
  p_plan_id UUID,
  p_offer_id UUID,
  p_guest_id UUID,
  p_host_id UUID,
  p_guest_amount_cents INTEGER,
  p_escrow_pattern TEXT DEFAULT 'B',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _escrow public.escrow_transactions%ROWTYPE;
  _escrow_id UUID;
  _idx INT;
  _gross INT;
  _currency TEXT;
  _meta JSONB;
  _slot_reusable BOOLEAN;
BEGIN
  IF p_guest_amount_cents IS NULL OR p_guest_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_guest_amount';
  END IF;

  _gross := public.gross_amount_cents(p_guest_amount_cents)::INT;

  SELECT COALESCE(currency, 'NGN') INTO _currency
  FROM public.plans
  WHERE id = p_plan_id;

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = p_guest_id
  FOR UPDATE;

  IF FOUND THEN
    IF _escrow.status IN ('pending_funding', 'funded', 'active')
       AND _escrow.offer_id IS NOT DISTINCT FROM p_offer_id THEN
      RETURN _escrow.id;
    END IF;

    IF _escrow.status IN ('funded', 'active') THEN
      RAISE EXCEPTION 'guest_escrow_already_funded';
    END IF;

    _slot_reusable :=
      _escrow.status IN ('cancelled', 'refunded', 'released', 'disputed')
      OR (
        _escrow.status = 'pending_funding'
        AND _escrow.offer_id IS DISTINCT FROM p_offer_id
      );

    IF _slot_reusable THEN
      _meta :=
        (COALESCE(_escrow.metadata, '{}'::jsonb)
          - 'payment_initiated_at'
          - 'checkout_reference'
          - 'checkout_initiated_by'
          - 'checkout_returned_at'
          - 'charge_confirmed_at')
        || COALESCE(p_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'reactivated_at', NOW(),
          'previous_status', _escrow.status,
          'previous_offer_id', _escrow.offer_id
        );

      UPDATE public.escrow_transactions SET
        offer_id = p_offer_id,
        payer_id = p_guest_id,
        payee_id = p_host_id,
        host_id = p_host_id,
        status = 'pending_funding',
        escrow_pattern = COALESCE(p_escrow_pattern, 'B'),
        amount_cents = _gross,
        host_share_cents = 0,
        guest_share_cents = p_guest_amount_cents,
        guest_funded_at = NULL,
        host_funded_at = NULL,
        funded_at = NULL,
        funding_deadline = NOW() + INTERVAL '24 hours',
        payment_tx_ref = NULL,
        paystack_reference = NULL,
        platform_fee_cents = 0,
        goodwill_applied_cents = 0,
        metadata = _meta,
        updated_at = NOW()
      WHERE id = _escrow.id
      RETURNING id INTO _escrow_id;

      RETURN _escrow_id;
    END IF;

    RETURN _escrow.id;
  END IF;

  SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO _idx
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id;

  INSERT INTO public.escrow_transactions (
    plan_id,
    offer_id,
    payer_id,
    payee_id,
    host_id,
    guest_id,
    group_plan_index,
    escrow_pattern,
    amount_cents,
    host_share_cents,
    guest_share_cents,
    funding_deadline,
    currency,
    status,
    metadata
  ) VALUES (
    p_plan_id,
    p_offer_id,
    p_guest_id,
    p_host_id,
    p_host_id,
    p_guest_id,
    _idx,
    COALESCE(p_escrow_pattern, 'B'),
    _gross,
    0,
    p_guest_amount_cents,
    NOW() + INTERVAL '24 hours',
    _currency,
    'pending_funding',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _escrow_id;

  RETURN _escrow_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_group_guest_escrow_slot(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_group_guest_escrow_slot(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
