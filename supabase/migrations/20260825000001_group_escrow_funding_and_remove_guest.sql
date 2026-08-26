-- Group split escrows: mark funded when required legs are paid (guest-only slots have host_share=0).
-- Fixes plan stuck on awaiting_payment and enables host removal with refunds.

CREATE OR REPLACE FUNCTION public.escrow_legs_satisfied(p_escrow public.escrow_transactions)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_host_share BIGINT;
  v_guest_share BIGINT;
BEGIN
  IF p_escrow.escrow_pattern IS DISTINCT FROM 'B' THEN
    RETURN p_escrow.status IN ('funded', 'active', 'released');
  END IF;

  v_host_share := GREATEST(0, COALESCE(p_escrow.host_share_cents, 0));
  v_guest_share := GREATEST(0, COALESCE(p_escrow.guest_share_cents, 0));

  IF v_host_share <= 0 THEN
    RETURN p_escrow.guest_funded_at IS NOT NULL;
  END IF;
  IF v_guest_share <= 0 THEN
    RETURN p_escrow.host_funded_at IS NOT NULL;
  END IF;

  RETURN p_escrow.host_funded_at IS NOT NULL AND p_escrow.guest_funded_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.escrow_funding_complete(p_escrow public.escrow_transactions)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_escrow.status IN ('funded', 'active', 'released')
    OR public.escrow_legs_satisfied(p_escrow);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escrow_sync_split_funding_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.escrow_pattern = 'B'
    AND NEW.status = 'pending_funding'
    AND public.escrow_legs_satisfied(NEW) THEN
    NEW.status := 'funded';
    NEW.funded_at := COALESCE(
      NEW.funded_at,
      NEW.guest_funded_at,
      NEW.host_funded_at,
      NOW()
    );
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escrow_sync_split_funding_status ON public.escrow_transactions;
CREATE TRIGGER trg_escrow_sync_split_funding_status
  BEFORE INSERT OR UPDATE OF status, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents
  ON public.escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_escrow_sync_split_funding_status();

UPDATE public.escrow_transactions e
SET
  status = 'funded',
  funded_at = COALESCE(e.funded_at, e.guest_funded_at, e.host_funded_at, NOW()),
  updated_at = NOW()
WHERE e.escrow_pattern = 'B'
  AND e.status = 'pending_funding'
  AND public.escrow_legs_satisfied(e);

CREATE OR REPLACE FUNCTION public.check_plan_escrow_fully_funded(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF public.is_group_split_dynamic_plan(_plan) THEN
    RETURN NOT EXISTS (
      SELECT 1
      FROM public.escrow_transactions e
      WHERE e.plan_id = p_plan_id
        AND e.status NOT IN ('cancelled', 'refunded')
        AND NOT public.escrow_funding_complete(e)
    );
  END IF;

  IF _plan.escrow_pattern = 'B' AND NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN (
      EXISTS (
        SELECT 1 FROM public.escrow_transactions
        WHERE plan_id = p_plan_id AND host_funded_at IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.escrow_transactions
        WHERE plan_id = p_plan_id AND guest_funded_at IS NOT NULL
      )
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.escrow_transactions
    WHERE plan_id = p_plan_id AND status IN ('funded', 'active', 'released')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escrow_try_activate_group_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.escrow_funding_complete(NEW)
    AND (
      TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.host_funded_at IS DISTINCT FROM NEW.host_funded_at
      OR OLD.guest_funded_at IS DISTINCT FROM NEW.guest_funded_at
    ) THEN
    PERFORM public.try_activate_group_split_plan(NEW.plan_id);
  END IF;
  RETURN NEW;
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
  v_result JSONB;
  v_credit INT;
  v_share INT;
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
    v_result := public._refund_escrow_wallet_credit(
      v_escrow.id,
      v_recipient,
      100,
      p_refund_platform_fee,
      NULL
    );
    RETURN v_result;
  END IF;

  IF v_escrow.guest_funded_at IS NULL THEN
    UPDATE public.escrow_transactions
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_escrow.id;
    RETURN jsonb_build_object('refunded', false, 'reason', 'not_funded', 'escrow_id', v_escrow.id);
  END IF;

  v_share := GREATEST(0, COALESCE(v_escrow.guest_share_cents, v_escrow.amount_cents, 0));
  v_credit := v_share;
  IF NOT p_refund_platform_fee THEN
    v_credit := v_credit - COALESCE(
      v_escrow.platform_fee_cents,
      public.platform_fee_cents_for_amount(v_credit)
    );
    IF v_credit < 0 THEN v_credit := 0; END IF;
  END IF;

  v_ref := 'group_remove_guest:' || p_plan_id::text || ':' || p_user_id::text || ':' || v_escrow.id::text;

  IF v_credit > 0 THEN
    PERFORM public._wallet_credit_internal(
      v_recipient,
      v_credit,
      'escrow_release',
      v_ref,
      jsonb_build_object('plan_id', p_plan_id, 'escrow_id', v_escrow.id, 'reason', 'host_removed_guest')
    );
    PERFORM public._queue_wallet_credit_by_reference(v_ref);
  END IF;

  UPDATE public.escrow_transactions
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = v_escrow.id;

  RETURN jsonb_build_object(
    'refunded', v_credit > 0,
    'amount_cents', v_credit,
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
    _slot_cents := GREATEST(0, COALESCE(_escrow.guest_share_cents, _escrow.amount_cents, 0));
  END IF;

  _refund := public._refund_group_guest_escrow(p_plan_id, p_guest_user_id, false);

  UPDATE public.plan_invitations
  SET status = 'declined', slot_held = FALSE, responded_at = NOW(), updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND invitee_user_id = p_guest_user_id
    AND status IN ('pending', 'accepted');

  UPDATE public.plan_join_requests
  SET status = 'declined', updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND requester_id = p_guest_user_id
    AND status IN ('pending', 'approved');

  UPDATE public.plan_offers
  SET status = 'declined', updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND bidder_id = p_guest_user_id
    AND status IN ('pending', 'accepted', 'countered', 'countered_by_host', 'countered_by_guest');

  UPDATE public.plans
  SET
    accepted_guest_count = GREATEST(0, COALESCE(accepted_guest_count, 0) - 1),
    accepted_guest_amounts_sum_cents = GREATEST(
      0,
      COALESCE(accepted_guest_amounts_sum_cents, 0) - _slot_cents
    ),
    current_suggested_share_cents = CASE
      WHEN public.is_group_split_dynamic_plan(_plan) THEN public.calculate_group_suggested_share(p_plan_id)
      ELSE current_suggested_share_cents
    END,
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

REVOKE ALL ON FUNCTION public.escrow_legs_satisfied(public.escrow_transactions) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.escrow_funding_complete(public.escrow_transactions) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_group_host_remove_guest(UUID, UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_group_host_remove_guest(UUID, UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
