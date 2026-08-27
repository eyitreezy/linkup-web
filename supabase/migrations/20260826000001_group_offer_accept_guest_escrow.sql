-- Part 1: Same funded member count for all viewers (bypasses escrow RLS visibility gaps).
CREATE OR REPLACE FUNCTION public.count_group_plan_funded_members(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _count INTEGER := 0;
  _guest public.escrow_transactions%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.guest_id IS NULL
      AND e.status NOT IN ('cancelled', 'refunded')
      AND (e.payer_id = _plan.creator_id OR e.host_id = _plan.creator_id)
      AND public.escrow_funding_complete(e)
  ) THEN
    _count := _count + 1;
  END IF;

  FOR _guest IN
    SELECT DISTINCT ON (e.guest_id) e.*
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.guest_id IS NOT NULL
      AND e.status NOT IN ('cancelled', 'refunded')
    ORDER BY e.guest_id, e.created_at ASC
  LOOP
    IF public.escrow_funding_complete(_guest) THEN
      _count := _count + 1;
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_group_plan_funded_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_group_plan_funded_members(UUID) TO anon;

-- Part 3: Create guest escrow rows when host accepts offers on negotiable group plans.
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
  v_idx INT;
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

      IF NOT EXISTS (
        SELECT 1 FROM public.escrow_transactions
        WHERE plan_id = v_plan.id
          AND guest_id = v_offer.bidder_id
          AND status NOT IN ('cancelled', 'refunded')
      ) THEN
        SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO v_idx
        FROM public.escrow_transactions WHERE plan_id = v_plan.id;

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
          v_plan.id,
          p_offer_id,
          v_offer.bidder_id,
          v_plan.creator_id,
          v_plan.creator_id,
          v_offer.bidder_id,
          v_idx,
          'B',
          public.gross_amount_cents(v_guest_amount)::INT,
          0,
          v_guest_amount,
          now() + interval '24 hours',
          COALESCE(v_plan.currency, 'NGN'),
          'pending_funding',
          jsonb_build_object('leg', 'guest_slot', 'dynamic_group_split', true)
        )
        RETURNING id INTO v_guest_escrow_id;
      ELSE
        SELECT id INTO v_guest_escrow_id
        FROM public.escrow_transactions
        WHERE plan_id = v_plan.id
          AND guest_id = v_offer.bidder_id
          AND status NOT IN ('cancelled', 'refunded')
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;

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
      IF COALESCE(v_plan.is_paid, false)
        AND v_guest_amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.escrow_transactions
          WHERE plan_id = v_plan.id
            AND guest_id = v_offer.bidder_id
            AND status NOT IN ('cancelled', 'refunded')
        ) THEN
        SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO v_idx
        FROM public.escrow_transactions WHERE plan_id = v_plan.id;

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
          v_plan.id,
          p_offer_id,
          v_offer.bidder_id,
          v_plan.creator_id,
          v_plan.creator_id,
          v_offer.bidder_id,
          v_idx,
          COALESCE(v_plan.escrow_pattern, 'B'),
          public.gross_amount_cents(v_guest_amount)::INT,
          0,
          v_guest_amount,
          now() + interval '24 hours',
          COALESCE(v_plan.currency, 'NGN'),
          'pending_funding',
          jsonb_build_object('leg', 'guest_slot', 'group_offer_accept', true)
        )
        RETURNING id INTO v_guest_escrow_id;
      ELSE
        SELECT id INTO v_guest_escrow_id
        FROM public.escrow_transactions
        WHERE plan_id = v_plan.id
          AND guest_id = v_offer.bidder_id
          AND status NOT IN ('cancelled', 'refunded')
        ORDER BY created_at DESC
        LIMIT 1;
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

-- VGC Outing: backfill missing guest escrow rows for accepted offers.
DO $$
DECLARE
  _plan_id UUID := 'fb662ca8-aaf3-4c23-a50a-270de1f3174a';
  _host_id UUID := '0e5fc484-35a9-464e-acc3-6ccbb856df3c';
  _guest RECORD;
  _idx INT;
  _amount INT;
BEGIN
  FOR _guest IN
    SELECT * FROM (
      VALUES
        ('97698687-b604-4dad-a852-01d5aeede0c0'::UUID, 8333300),
        ('c7a248f9-4103-4388-bc38-4ba79581d8ca'::UUID, 10000000)
    ) AS t(guest_id, budget_cents)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.escrow_transactions
      WHERE plan_id = _plan_id
        AND guest_id = _guest.guest_id
        AND status NOT IN ('cancelled', 'refunded')
    ) THEN
      CONTINUE;
    END IF;

    _amount := _guest.budget_cents;
    SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO _idx
    FROM public.escrow_transactions WHERE plan_id = _plan_id;

    INSERT INTO public.escrow_transactions (
      plan_id,
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
    )
    SELECT
      _plan_id,
      _guest.guest_id,
      _host_id,
      _host_id,
      _guest.guest_id,
      _idx,
      COALESCE(p.escrow_pattern, 'B'),
      public.gross_amount_cents(_amount)::INT,
      0,
      _amount,
      NOW() + INTERVAL '24 hours',
      COALESCE(p.currency, 'NGN'),
      'pending_funding',
      jsonb_build_object('leg', 'guest_slot', 'backfill', true)
    FROM public.plans p
    WHERE p.id = _plan_id;
  END LOOP;
END;
$$;
