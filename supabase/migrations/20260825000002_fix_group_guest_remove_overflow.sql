-- Fix guest removal "integer out of range": use BIGINT for cent math, refund guest budget
-- share on host remove, and safely recalculate suggested share after removal.

CREATE OR REPLACE FUNCTION public._refund_escrow_wallet_credit(
  p_escrow_id UUID,
  p_recipient_id UUID,
  p_refund_percent INT DEFAULT 100,
  p_refund_platform_fee BOOLEAN DEFAULT true,
  p_reference_suffix TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_credit BIGINT;
  v_wallet_credit INT;
  v_ref TEXT;
  v_pct INT;
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_recipient');
  END IF;

  v_pct := GREATEST(0, LEAST(COALESCE(p_refund_percent, 100), 100));

  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE id = p_escrow_id
    AND status IN ('funded', 'active', 'held')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_escrow');
  END IF;

  v_credit := COALESCE(v_escrow.amount_cents, 0)::BIGINT;
  IF NOT p_refund_platform_fee THEN
    v_credit := v_credit - COALESCE(
      v_escrow.platform_fee_cents,
      public.platform_fee_cents_for_amount(v_credit::INT)
    )::BIGINT;
    IF v_credit < 0 THEN v_credit := 0; END IF;
  END IF;

  v_credit := FLOOR(v_credit * v_pct / 100.0);
  IF v_credit < 0 THEN v_credit := 0; END IF;
  IF v_credit > 2147483647 THEN
    RAISE EXCEPTION 'refund_amount_too_large';
  END IF;

  v_wallet_credit := v_credit::INT;

  v_ref := 'group_refund:' || v_escrow.plan_id::text || ':' || p_recipient_id::text || ':' || v_escrow.id::text;
  IF p_reference_suffix IS NOT NULL AND p_reference_suffix <> '' THEN
    v_ref := v_ref || ':' || p_reference_suffix;
  END IF;

  IF v_wallet_credit > 0 THEN
    PERFORM public._wallet_credit_internal(
      p_recipient_id,
      v_wallet_credit,
      'escrow_release',
      v_ref,
      jsonb_build_object('plan_id', v_escrow.plan_id, 'escrow_id', v_escrow.id)
    );
    PERFORM public._queue_wallet_credit_by_reference(v_ref);
  END IF;

  UPDATE public.escrow_transactions
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = v_escrow.id;

  RETURN jsonb_build_object(
    'refunded', v_wallet_credit > 0,
    'amount_cents', v_wallet_credit,
    'escrow_id', v_escrow.id,
    'recipient_id', p_recipient_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._refund_group_guest_escrow(
  p_plan_id UUID,
  p_user_id UUID,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_recipient UUID;
  v_credit BIGINT;
  v_wallet_credit INT;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id IS NOT NULL
    AND (
      guest_id = p_user_id
      OR payer_id = p_user_id
    )
    AND status NOT IN ('cancelled', 'refunded')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_escrow');
  END IF;

  v_recipient := COALESCE(v_escrow.payer_id, v_escrow.guest_id, p_user_id);

  IF v_escrow.status IN ('funded', 'active', 'held') THEN
    IF p_refund_platform_fee THEN
      RETURN public._refund_escrow_wallet_credit(
        v_escrow.id,
        v_recipient,
        100,
        true,
        NULL
      );
    END IF;

    v_credit := GREATEST(
      0,
      COALESCE(
        v_escrow.guest_share_cents,
        COALESCE(v_escrow.amount_cents, 0)::BIGINT
          - COALESCE(
              v_escrow.platform_fee_cents,
              public.platform_fee_cents_for_amount(COALESCE(v_escrow.amount_cents, 0))
            )::BIGINT
      )
    )::BIGINT;
  ELSIF v_escrow.guest_funded_at IS NOT NULL THEN
    v_credit := GREATEST(
      0,
      COALESCE(
        v_escrow.guest_share_cents,
        COALESCE(v_escrow.amount_cents, 0)::BIGINT
          - COALESCE(
              v_escrow.platform_fee_cents,
              public.platform_fee_cents_for_amount(COALESCE(v_escrow.amount_cents, 0))
            )::BIGINT
      )
    )::BIGINT;
  ELSE
    UPDATE public.escrow_transactions
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_escrow.id;
    RETURN jsonb_build_object('refunded', false, 'reason', 'not_funded', 'escrow_id', v_escrow.id);
  END IF;

  IF v_credit <= 0 THEN
    UPDATE public.escrow_transactions
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_escrow.id;
    RETURN jsonb_build_object('refunded', false, 'reason', 'zero_credit', 'escrow_id', v_escrow.id);
  END IF;

  IF v_credit > 2147483647 THEN
    RAISE EXCEPTION 'refund_amount_too_large';
  END IF;

  v_wallet_credit := v_credit::INT;
  v_ref := 'group_remove_guest:' || p_plan_id::text || ':' || p_user_id::text || ':' || v_escrow.id::text;

  PERFORM public._wallet_credit_internal(
    v_recipient,
    v_wallet_credit,
    'escrow_release',
    v_ref,
    jsonb_build_object('plan_id', p_plan_id, 'escrow_id', v_escrow.id, 'reason', 'host_removed_guest')
  );
  PERFORM public._queue_wallet_credit_by_reference(v_ref);

  UPDATE public.escrow_transactions
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = v_escrow.id;

  RETURN jsonb_build_object(
    'refunded', true,
    'amount_cents', v_wallet_credit,
    'escrow_id', v_escrow.id,
    'recipient_id', v_recipient
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_group_host_remove_guest(
  p_plan_id UUID,
  p_guest_user_id UUID,
  p_reason_type TEXT DEFAULT NULL,
  p_reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _escrow public.escrow_transactions%ROWTYPE;
  _slot_cents BIGINT := 0;
  _new_share BIGINT;
  _refund JSONB;
BEGIN
  IF _host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_guest_user_id IS NULL OR p_guest_user_id = _host_id THEN
    RAISE EXCEPTION 'invalid_guest';
  END IF;

  SELECT * INTO _plan
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id <> _host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false) THEN
    RAISE EXCEPTION 'not_group_plan';
  END IF;

  IF _plan.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'plan_not_removable';
  END IF;

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = p_guest_user_id
    AND status NOT IN ('cancelled', 'refunded')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.plan_invitations
      WHERE plan_id = p_plan_id AND invitee_user_id = p_guest_user_id AND status = 'accepted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_join_requests
      WHERE plan_id = p_plan_id AND requester_id = p_guest_user_id AND status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_offers
      WHERE plan_id = p_plan_id AND bidder_id = p_guest_user_id AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'guest_not_on_plan';
    END IF;
  ELSE
    _slot_cents := GREATEST(0, COALESCE(_escrow.guest_share_cents, _escrow.amount_cents, 0)::BIGINT);
  END IF;

  _refund := public._refund_group_guest_escrow(p_plan_id, p_guest_user_id, false);

  UPDATE public.plan_invitations
  SET
    status = 'declined',
    slot_held = FALSE,
    responded_at = NOW(),
    decline_reason = COALESCE(NULLIF(trim(p_reason_type), ''), 'host_removed'),
    decline_reason_other = CASE
      WHEN COALESCE(p_reason_type, '') = 'other' THEN NULLIF(trim(p_reason_text), '')
      ELSE NULL
    END
  WHERE plan_id = p_plan_id
    AND invitee_user_id = p_guest_user_id
    AND status IN ('pending', 'accepted');

  UPDATE public.plan_join_requests
  SET status = 'declined', updated_at = NOW(), responded_at = NOW()
  WHERE plan_id = p_plan_id
    AND requester_id = p_guest_user_id
    AND status IN ('pending', 'approved');

  UPDATE public.plan_offers
  SET status = 'declined', updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND bidder_id = p_guest_user_id
    AND status IN ('pending', 'accepted', 'countered', 'countered_by_host', 'countered_by_guest');

  _new_share := COALESCE(_plan.current_suggested_share_cents, 0)::BIGINT;
  IF public.is_group_split_dynamic_plan(_plan) THEN
    BEGIN
      _new_share := public.calculate_group_suggested_share(p_plan_id)::BIGINT;
    EXCEPTION
      WHEN numeric_value_out_of_range OR division_by_zero THEN
        _new_share := COALESCE(_plan.current_suggested_share_cents, 0)::BIGINT;
    END;
  END IF;

  UPDATE public.plans
  SET
    accepted_guest_count = GREATEST(0, COALESCE(accepted_guest_count, 0) - 1),
    accepted_guest_amounts_sum_cents = GREATEST(
      0,
      COALESCE(accepted_guest_amounts_sum_cents, 0)::BIGINT - _slot_cents
    )::INT,
    current_suggested_share_cents = LEAST(GREATEST(COALESCE(_new_share, 0), 0), 2147483647)::INT,
    updated_at = NOW()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'removed', true,
    'guest_user_id', p_guest_user_id,
    'reason_type', p_reason_type,
    'reason_text', p_reason_text,
    'refund', _refund
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
