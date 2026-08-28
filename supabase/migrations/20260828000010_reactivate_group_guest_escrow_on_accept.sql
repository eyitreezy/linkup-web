-- Re-accepting a removed group guest must reuse their cancelled escrow row
-- (unique constraint escrow_transactions_plan_guest_unique on plan_id + guest_id).

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

  -- At most one row per (plan_id, guest_id) because of escrow_transactions_plan_guest_unique.
  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = p_guest_id
  FOR UPDATE;

  IF FOUND THEN
    -- Idempotent: same offer already has a live slot.
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

CREATE OR REPLACE FUNCTION public.host_respond_to_offer(
  p_offer_id UUID,
  p_action TEXT,
  p_counter_amount_cents INTEGER DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_proposed_scheduled_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.plan_offers%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_host_id UUID := auth.uid();
  v_agreed_amount INTEGER;
  v_merged_schedule TIMESTAMPTZ;
  v_is_group_split BOOLEAN;
  v_guest_amount INTEGER;
  v_guest_escrow_id UUID;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_offer FROM public.plan_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_offer.plan_id FOR UPDATE;
  IF v_plan.creator_id != v_host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF v_plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  IF v_offer.awaiting_response_from IS DISTINCT FROM 'host' THEN
    RAISE EXCEPTION 'not_your_turn';
  END IF;

  v_is_group_split := public.is_group_split_dynamic_plan(v_plan);

  IF p_action = 'accept' THEN
    UPDATE public.plan_offers SET
      status = 'accepted',
      last_action_by = 'host',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    IF v_is_group_split THEN
      v_guest_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, 0);
      IF v_guest_amount <= 0 THEN
        v_guest_amount := public.resolve_join_request_slot_cents(v_plan)::INTEGER;
      END IF;
      IF v_guest_amount <= 0 THEN
        RAISE EXCEPTION 'invalid_guest_amount';
      END IF;

      IF COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, 0) <= 0 THEN
        UPDATE public.plan_offers SET
          amount_cents = v_guest_amount,
          current_amount_cents = v_guest_amount,
          updated_at = now()
        WHERE id = p_offer_id;
      END IF;

      v_guest_escrow_id := public.ensure_group_guest_escrow_slot(
        v_plan.id,
        p_offer_id,
        v_offer.bidder_id,
        v_plan.creator_id,
        v_guest_amount,
        'B',
        jsonb_build_object('leg', 'guest_slot', 'dynamic_group_split', true)
      );

      UPDATE public.plans SET
        status = 'negotiating'::public.plan_status,
        accepted_guest_count = COALESCE(accepted_guest_count, 0) + 1,
        accepted_guest_amounts_sum_cents =
          COALESCE(accepted_guest_amounts_sum_cents, 0) + v_guest_amount,
        current_suggested_share_cents = public.calculate_group_suggested_share(v_plan.id),
        updated_at = now()
      WHERE id = v_plan.id;

      PERFORM public.create_notification(
        v_offer.bidder_id,
        'slot_accepted_fund_now',
        'Your slot is confirmed!',
        'Fund your share to secure your spot on this group plan.',
        jsonb_build_object(
          'href', '/plan/' || v_plan.id || '/agreement',
          'planId', v_plan.id::text,
          'offerId', p_offer_id::text,
          'escrowId', v_guest_escrow_id::text,
          'amountCents', v_guest_amount
        )
      );

    ELSIF COALESCE(v_plan.is_group_plan, false) THEN
      v_guest_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, 0);
      IF v_guest_amount <= 0 THEN
        v_guest_amount := public.resolve_join_request_slot_cents(v_plan)::INTEGER;
      END IF;
      IF v_guest_amount <= 0 AND COALESCE(v_plan.is_paid, false) THEN
        RAISE EXCEPTION 'invalid_guest_amount';
      END IF;

      IF COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, 0) <= 0 AND v_guest_amount > 0 THEN
        UPDATE public.plan_offers SET
          amount_cents = v_guest_amount,
          current_amount_cents = v_guest_amount,
          updated_at = now()
        WHERE id = p_offer_id;
      END IF;

      UPDATE public.plans SET
        status = 'negotiating'::public.plan_status,
        accepted_guest_count = COALESCE(accepted_guest_count, 0) + 1,
        updated_at = now()
      WHERE id = v_plan.id;

      v_guest_escrow_id := NULL;
      IF COALESCE(v_plan.is_paid, false) AND v_guest_amount > 0 THEN
        v_guest_escrow_id := public.ensure_group_guest_escrow_slot(
          v_plan.id,
          p_offer_id,
          v_offer.bidder_id,
          v_plan.creator_id,
          v_guest_amount,
          COALESCE(v_plan.escrow_pattern, 'B'),
          jsonb_build_object('leg', 'guest_slot', 'group_offer_accept', true)
        );
      END IF;

      PERFORM public.create_notification(
        v_offer.bidder_id,
        CASE WHEN v_guest_escrow_id IS NOT NULL THEN 'slot_accepted_fund_now' ELSE 'offer_accepted' END,
        CASE WHEN v_guest_escrow_id IS NOT NULL THEN 'Your slot is confirmed!' ELSE 'Your offer was accepted!' END,
        CASE
          WHEN v_guest_escrow_id IS NOT NULL THEN 'Fund your share to secure your spot on this group plan.'
          ELSE 'Review the agreement and proceed to secure payment when ready.'
        END,
        jsonb_build_object(
          'href', '/plan/' || v_plan.id || '/agreement',
          'planId', v_plan.id::text,
          'offerId', p_offer_id::text,
          'escrowId', v_guest_escrow_id::text,
          'amountCents', v_guest_amount
        )
      );

    ELSE
      UPDATE public.plan_offers SET status = 'superseded'
      WHERE plan_id = v_plan.id AND id <> p_offer_id
        AND status IN ('pending', 'countered', 'countered_by_host', 'countered_by_guest');

      v_agreed_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, v_plan.starting_price_cents, 0);
      v_merged_schedule := COALESCE(p_proposed_scheduled_at, v_offer.proposed_scheduled_at, v_plan.scheduled_at);

      UPDATE public.plans SET
        status = 'agreed'::public.plan_status,
        accepted_offer_id = p_offer_id,
        agreed_price_cents = CASE WHEN v_agreed_amount > 0 THEN v_agreed_amount ELSE NULL END,
        agreed_scheduled_at = v_merged_schedule,
        agreed_location = COALESCE(v_plan.location_label, agreed_location),
        agreed_notes = COALESCE(v_offer.message, agreed_notes),
        scheduled_at = COALESCE(v_merged_schedule, scheduled_at),
        updated_at = now()
      WHERE id = v_plan.id;

      PERFORM public.create_notification(
        v_offer.bidder_id,
        'offer_accepted',
        'Your offer was accepted!',
        'Review the agreement and proceed to secure payment when ready.',
        jsonb_build_object(
          'href', '/plan/' || v_plan.id || '/agreement',
          'planId', v_plan.id::text,
          'offerId', p_offer_id::text
        )
      );
    END IF;

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'accept', NULL, p_note);

  ELSIF p_action = 'counter' THEN
    IF p_counter_amount_cents IS NULL THEN
      RAISE EXCEPTION 'counter_amount_required';
    END IF;

    UPDATE public.plan_offers SET
      amount_cents = p_counter_amount_cents,
      current_amount_cents = p_counter_amount_cents,
      message = COALESCE(p_note, message),
      proposed_scheduled_at = COALESCE(p_proposed_scheduled_at, proposed_scheduled_at),
      status = 'countered_by_host',
      last_action_by = 'host',
      awaiting_response_from = 'guest',
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_countered',
      'The host made a counter offer',
      'Review their counter and respond.',
      jsonb_build_object(
        'href', '/plan/' || v_plan.id || '/negotiate',
        'planId', v_plan.id::text,
        'offerId', p_offer_id::text
      )
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'counter', p_counter_amount_cents, p_note);

  ELSIF p_action = 'decline' THEN
    UPDATE public.plan_offers SET
      status = 'declined',
      last_action_by = 'host',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_declined',
      'Your offer was not accepted',
      'You can submit a new offer or explore other plans.',
      jsonb_build_object('href', '/plan/' || v_plan.id, 'planId', v_plan.id::text)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'decline', NULL, p_note);
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.host_respond_to_offer(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
