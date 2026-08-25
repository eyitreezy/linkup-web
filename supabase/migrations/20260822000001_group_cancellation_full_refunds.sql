-- Group host cancellation: refund every funded guest-slot escrow, host leg (partial),
-- and issue matrix goodwill credits. Fixes missed refunds for join-request guests and
-- escrows matched by payer_id rather than guest_id alone.

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
  v_credit INT;
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

  v_credit := COALESCE(v_escrow.amount_cents, 0);
  IF NOT p_refund_platform_fee THEN
    v_credit := v_credit - COALESCE(
      v_escrow.platform_fee_cents,
      public.platform_fee_cents_for_amount(v_credit)
    );
    IF v_credit < 0 THEN v_credit := 0; END IF;
  END IF;

  v_credit := FLOOR(v_credit * v_pct / 100.0)::INT;
  IF v_credit < 0 THEN v_credit := 0; END IF;

  v_ref := 'group_refund:' || v_escrow.plan_id::text || ':' || p_recipient_id::text || ':' || v_escrow.id::text;
  IF p_reference_suffix IS NOT NULL AND p_reference_suffix <> '' THEN
    v_ref := v_ref || ':' || p_reference_suffix;
  END IF;

  IF v_credit > 0 THEN
    PERFORM public._wallet_credit_internal(
      p_recipient_id,
      v_credit,
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
    'refunded', true,
    'amount_cents', v_credit,
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
  v_result JSONB;
BEGIN
  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id IS NOT NULL
    AND (
      guest_id = p_user_id
      OR payer_id = p_user_id
    )
    AND status IN ('funded', 'active', 'held')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_escrow');
  END IF;

  v_recipient := COALESCE(v_escrow.payer_id, v_escrow.guest_id, p_user_id);
  v_result := public._refund_escrow_wallet_credit(
    v_escrow.id,
    v_recipient,
    100,
    p_refund_platform_fee,
    NULL
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public._refund_all_group_plan_guest_escrows(
  p_plan_id UUID,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_recipient UUID;
BEGIN
  FOR v_escrow IN
    SELECT *
    FROM public.escrow_transactions
    WHERE plan_id = p_plan_id
      AND guest_id IS NOT NULL
      AND status IN ('funded', 'active', 'held')
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    v_recipient := COALESCE(v_escrow.payer_id, v_escrow.guest_id);
    IF v_recipient IS NOT NULL THEN
      PERFORM public._refund_escrow_wallet_credit(
        v_escrow.id,
        v_recipient,
        100,
        p_refund_platform_fee,
        NULL
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._refund_group_host_escrow(
  p_plan_id UUID,
  p_refund_percent INT DEFAULT 100,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_escrow public.escrow_transactions%ROWTYPE;
  v_recipient UUID;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'plan_not_found');
  END IF;

  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id IS NULL
    AND (
      payer_id = v_plan.creator_id
      OR (payer_id IS NULL AND host_id = v_plan.creator_id)
    )
    AND status IN ('funded', 'active', 'held')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_escrow');
  END IF;

  v_recipient := COALESCE(v_escrow.payer_id, v_plan.creator_id);
  RETURN public._refund_escrow_wallet_credit(
    v_escrow.id,
    v_recipient,
    p_refund_percent,
    p_refund_platform_fee,
    'host'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._refund_all_group_guests(
  p_plan_id UUID,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._refund_all_group_plan_guest_escrows(p_plan_id, p_refund_platform_fee);
END;
$$;

CREATE OR REPLACE FUNCTION public._group_cancellation_goodwill_base(
  p_plan public.plans,
  p_tier TEXT
)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_share INT;
BEGIN
  IF COALESCE(p_tier, 'none') = 'none' THEN
    RETURN 0;
  END IF;

  v_share := COALESCE(
    p_plan.current_suggested_share_cents,
    p_plan.agreed_price_cents,
    p_plan.starting_price_cents,
    500
  );

  RETURN CASE p_tier
    WHEN 'standard' THEN LEAST(500, GREATEST(200, FLOOR(v_share * 0.05)::INT))
    WHEN 'enhanced' THEN LEAST(1000, GREATEST(400, FLOOR(v_share * 0.10)::INT))
    ELSE 0
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_group_host_cancellation(
  p_plan_id UUID,
  p_reason_type TEXT,
  p_reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _terms JSONB;
  _guest UUID;
  _goodwill TEXT;
  _host_refund_pct INT;
  _goodwill_base INT;
  _goodwill_amt INT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF _plan.creator_id <> _user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_a_group_plan'; END IF;

  _terms := public.get_cancellation_terms(p_plan_id, 'host', false);
  _host_refund_pct := COALESCE((_terms->>'canceller_refund_percent')::int, 100);
  _goodwill := COALESCE(_terms->>'other_party_goodwill_credit', 'none');
  _goodwill_base := public._group_cancellation_goodwill_base(_plan, _goodwill);

  UPDATE public.plans
  SET status = 'cancelled',
      cancellation_reason_type = p_reason_type,
      cancellation_reason_text = p_reason_text,
      cancellation_timing_band = _terms->>'timing_band',
      cancellation_host_refund_percent = _host_refund_pct,
      cancellation_guest_penalty_percent = (_terms->>'other_party_penalty_percent')::int,
      updated_at = NOW()
  WHERE id = p_plan_id;

  PERFORM public._apply_user_strikes(_user_id, COALESCE((_terms->>'trust_strikes')::int, 0));
  PERFORM public._refund_all_group_plan_guest_escrows(p_plan_id, true);
  PERFORM public._refund_group_host_escrow(p_plan_id, _host_refund_pct, true);

  FOR _guest IN
    SELECT DISTINCT guest_id
    FROM (
      SELECT po.bidder_id AS guest_id
      FROM public.plan_offers po
      WHERE po.plan_id = p_plan_id
        AND po.status = 'accepted'::public.offer_status
      UNION
      SELECT jr.requester_id AS guest_id
      FROM public.plan_join_requests jr
      WHERE jr.plan_id = p_plan_id
        AND jr.status = 'approved'
    ) guests
    WHERE guest_id IS NOT NULL
  LOOP
    IF _goodwill_base > 0 THEN
      _goodwill_amt := public.goodwill_credit_amount(_guest, _goodwill_base);
      IF _goodwill_amt > 0 THEN
        PERFORM public._goodwill_issue_internal(
          _guest,
          _goodwill_amt,
          'cancellation',
          p_plan_id::text || ':guest:' || _guest::text
        );
      END IF;
    END IF;

    PERFORM public.create_notification(
      _guest,
      'group_plan_host_cancelled',
      'Group Plan cancelled by host',
      'The host has cancelled your group meetup. Your full contribution has been refunded.'
        || CASE WHEN _goodwill <> 'none' THEN ' A Goodwill Credit has been added to your wallet.' ELSE '' END,
      jsonb_build_object('href', '/wallet', 'planId', p_plan_id::text),
      'high',
      NULL
    );
  END LOOP;

  RETURN jsonb_build_object('cancelled', true, 'terms', _terms);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_group_host_cancellation(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
