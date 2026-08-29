-- Group plan membership capacity, eligibility guards, and guest opt-out (BIGINT-safe).

ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'opted_out';

CREATE OR REPLACE FUNCTION public.count_group_accepted_guests(p_plan_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(DISTINCT guest_id), 0)::INT
  FROM (
    SELECT invitee_user_id AS guest_id
    FROM public.plan_invitations
    WHERE plan_id = p_plan_id
      AND status = 'accepted'
      AND invitee_user_id IS NOT NULL
    UNION
    SELECT requester_id AS guest_id
    FROM public.plan_join_requests
    WHERE plan_id = p_plan_id
      AND status = 'approved'
    UNION
    SELECT bidder_id AS guest_id
    FROM public.plan_offers
    WHERE plan_id = p_plan_id
      AND status = 'accepted'
  ) roster
  WHERE guest_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.count_group_accepted_guests(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_user_confirmed_group_guest(
  p_plan_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT invitee_user_id AS guest_id
      FROM public.plan_invitations
      WHERE plan_id = p_plan_id
        AND status = 'accepted'
        AND invitee_user_id IS NOT NULL
      UNION
      SELECT requester_id AS guest_id
      FROM public.plan_join_requests
      WHERE plan_id = p_plan_id
        AND status = 'approved'
      UNION
      SELECT bidder_id AS guest_id
      FROM public.plan_offers
      WHERE plan_id = p_plan_id
        AND status = 'accepted'
    ) roster
    WHERE guest_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_confirmed_group_guest(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_plan_available_slots(p_plan_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _accepted INT;
  _max INT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN 0;
  END IF;

  _max := GREATEST(0, COALESCE(_plan.max_guests, 0));
  _accepted := GREATEST(
    COALESCE(_plan.accepted_guest_count, 0),
    public.count_group_accepted_guests(p_plan_id)
  );

  RETURN GREATEST(0, _max - _accepted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_available_slots(UUID) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.assert_group_plan_can_accept_guest(
  p_plan_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN;
  END IF;

  IF _plan.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'plan_not_active';
  END IF;

  IF _plan.creator_id = p_user_id THEN
    RAISE EXCEPTION 'host_cannot_join_as_guest';
  END IF;

  IF public.is_user_confirmed_group_guest(p_plan_id, p_user_id) THEN
    RAISE EXCEPTION 'already_group_guest';
  END IF;

  IF public.get_plan_available_slots(p_plan_id) <= 0 THEN
    RAISE EXCEPTION 'group_full';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_group_plan_can_accept_guest(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._trg_plan_join_requests_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.assert_group_plan_can_accept_guest(NEW.plan_id, NEW.requester_id);
  ELSIF TG_OP = 'UPDATE'
    AND NEW.status = 'approved'
    AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.assert_group_plan_can_accept_guest(NEW.plan_id, NEW.requester_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_join_requests_capacity ON public.plan_join_requests;
CREATE TRIGGER plan_join_requests_capacity
  BEFORE INSERT OR UPDATE OF status ON public.plan_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_plan_join_requests_capacity();

CREATE OR REPLACE FUNCTION public._trg_plan_offers_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = NEW.plan_id;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN NEW;
  END IF;

  -- First pending offer row after an accepted invitation (negotiable invite flow).
  IF EXISTS (
    SELECT 1
    FROM public.plan_invitations pi
    WHERE pi.plan_id = NEW.plan_id
      AND pi.invitee_user_id = NEW.bidder_id
      AND pi.status = 'accepted'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.plan_offers po
    WHERE po.plan_id = NEW.plan_id
      AND po.bidder_id = NEW.bidder_id
      AND po.id IS DISTINCT FROM NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  IF public.is_user_confirmed_group_guest(NEW.plan_id, NEW.bidder_id) THEN
    RAISE EXCEPTION 'already_group_guest';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plan_offers po
    WHERE po.plan_id = NEW.plan_id
      AND po.bidder_id = NEW.bidder_id
      AND po.id IS DISTINCT FROM NEW.id
      AND po.status NOT IN ('superseded', 'declined', 'withdrawn', 'expired', 'opted_out')
  ) AND public.get_plan_available_slots(NEW.plan_id) <= 0 THEN
    RAISE EXCEPTION 'group_full';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_offers_capacity ON public.plan_offers;
CREATE TRIGGER plan_offers_capacity
  BEFORE INSERT ON public.plan_offers
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_plan_offers_capacity();

CREATE OR REPLACE FUNCTION public.submit_guest_opt_out(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _guest_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _escrow public.escrow_transactions%ROWTYPE;
  _terms JSONB;
  _refund_pct INT;
  _slot_cents BIGINT := 0;
  _new_share BIGINT;
  _refund JSONB;
  _refund_cents INT := 0;
  _hours_until NUMERIC;
  _member_count INT;
  _minimum INT;
  _triggered_minimum_cancel BOOLEAN := false;
  _plan_title TEXT;
BEGIN
  IF _guest_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _plan
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false) THEN
    RAISE EXCEPTION 'not_group_plan';
  END IF;

  IF _plan.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'plan_not_active';
  END IF;

  IF NOT public.is_user_confirmed_group_guest(p_plan_id, _guest_id) THEN
    RAISE EXCEPTION 'not_confirmed_guest';
  END IF;

  _hours_until := EXTRACT(
    EPOCH FROM (COALESCE(_plan.agreed_scheduled_at, _plan.scheduled_at, NOW()) - NOW())
  ) / 3600.0;

  IF _hours_until < 48 THEN
    RAISE EXCEPTION 'opt_out_window_closed';
  END IF;

  _terms := public.get_cancellation_terms(p_plan_id, 'guest', false);
  _refund_pct := GREATEST(0, LEAST(COALESCE((_terms->>'canceller_refund_percent')::INT, 100), 100));

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = _guest_id
    AND status NOT IN ('cancelled', 'refunded')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    _slot_cents := GREATEST(
      0,
      COALESCE(_escrow.guest_share_cents, _escrow.amount_cents, 0)::BIGINT
    );
    IF _escrow.status IN ('funded', 'active', 'held') OR _escrow.guest_funded_at IS NOT NULL THEN
      _refund := public._refund_escrow_wallet_credit(
        _escrow.id,
        COALESCE(_escrow.payer_id, _escrow.guest_id, _guest_id),
        _refund_pct,
        (_refund_pct >= 100),
        'guest_opt_out'
      );
      _refund_cents := COALESCE((_refund->>'amount_cents')::INT, 0);
    ELSE
      UPDATE public.escrow_transactions
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = _escrow.id;
    END IF;
  END IF;

  UPDATE public.plan_invitations
  SET status = 'declined', slot_held = FALSE, responded_at = NOW()
  WHERE plan_id = p_plan_id
    AND invitee_user_id = _guest_id
    AND status IN ('pending', 'accepted');

  UPDATE public.plan_join_requests
  SET status = 'declined', updated_at = NOW(), responded_at = NOW()
  WHERE plan_id = p_plan_id
    AND requester_id = _guest_id
    AND status IN ('pending', 'approved');

  UPDATE public.plan_offers
  SET status = 'opted_out', updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND bidder_id = _guest_id
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

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;

  PERFORM public.reconcile_group_host_share_after_guest_remove(p_plan_id);
  PERFORM public.revalidate_group_plan_activation(p_plan_id);

  _minimum := GREATEST(1, COALESCE(_plan.minimum_member_count, 5));
  _member_count := public.count_group_plan_funded_members(p_plan_id);

  IF _member_count < _minimum THEN
    _triggered_minimum_cancel := true;
    UPDATE public.plans
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_plan_id AND status NOT IN ('cancelled', 'completed');

    PERFORM public._refund_all_group_guests(p_plan_id, true);
    PERFORM public.create_notification(
      _plan.creator_id,
      'group_minimum_not_met',
      'Group plan cancelled',
      format(
        'A guest opted out and the group fell below the minimum of %s confirmed members. All members have been refunded.',
        _minimum
      ),
      jsonb_build_object('href', '/discover', 'planId', p_plan_id::text),
      'high',
      NULL
    );
  END IF;

  _plan_title := COALESCE(NULLIF(trim(_plan.title), ''), 'the group plan');

  PERFORM public.create_notification(
    _plan.creator_id,
    'group_plan_guest_opted_out',
    'Guest opted out',
    format('%s opted out of "%s".', 'A guest', _plan_title),
    jsonb_build_object('href', '/plan/' || p_plan_id::text, 'planId', p_plan_id::text),
    'medium',
    NULL
  );

  RETURN jsonb_build_object(
    'opted_out', true,
    'triggered_minimum_cancel', _triggered_minimum_cancel,
    'new_member_count', _member_count,
    'refund_cents', _refund_cents,
    'terms', _terms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_opt_out(UUID) TO authenticated;

-- Capacity guard before accepting offers onto a full group roster.
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
    IF COALESCE(v_plan.is_group_plan, false)
      AND NOT public.is_user_confirmed_group_guest(v_plan.id, v_offer.bidder_id) THEN
      PERFORM public.assert_group_plan_can_accept_guest(v_plan.id, v_offer.bidder_id);
    END IF;

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
          (COALESCE(accepted_guest_amounts_sum_cents, 0)::BIGINT + v_guest_amount::BIGINT)::INT,
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
