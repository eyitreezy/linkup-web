-- Block group plan cancellation via submit_plan_cancellation.
-- Hosts use submit_group_host_cancellation; guests use submit_guest_opt_out when eligible.

CREATE OR REPLACE FUNCTION public.submit_plan_cancellation(
  p_plan_id UUID,
  p_no_show BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan RECORD;
  v_offer RECORD;
  v_escrow RECORD;
  v_role TEXT;
  v_meet TIMESTAMPTZ;
  v_hours DOUBLE PRECISION;
  v_pattern TEXT;
  v_host_share INT;
  v_guest_share INT;
  v_host_paid INT := 0;
  v_guest_paid INT := 0;
  v_total INT;
  v_guest_credit INT := 0;
  v_host_credit INT := 0;
  v_guest_bps INT := 0;
  v_type TEXT;
  v_band TEXT;
  v_strikes INT := 0;
  v_goodwill INT := 0;
  v_goodwill_base INT := 0;
  v_goodwill_user UUID := NULL;
  v_guest_id UUID;
  v_host_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  IF COALESCE(v_plan.is_group_plan, false) THEN
    IF v_plan.creator_id = v_uid THEN
      RAISE EXCEPTION 'use_group_host_cancellation';
    END IF;
    RAISE EXCEPTION 'group_guest_cannot_cancel_plan';
  END IF;

  IF v_plan.accepted_offer_id IS NULL THEN RAISE EXCEPTION 'no_accepted_offer'; END IF;
  SELECT * INTO v_offer FROM public.plan_offers WHERE id = v_plan.accepted_offer_id;

  v_host_id := v_plan.creator_id;
  v_guest_id := v_offer.bidder_id;

  IF v_host_id = v_uid THEN v_role := 'host';
  ELSIF v_guest_id = v_uid THEN v_role := 'guest';
  ELSE RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_plan.status NOT IN ('agreed', 'awaiting_payment', 'active') THEN
    RAISE EXCEPTION 'plan_not_cancellable';
  END IF;

  v_meet := COALESCE(v_plan.agreed_scheduled_at, v_plan.scheduled_at, now() + interval '48 hours');
  v_hours := EXTRACT(EPOCH FROM (v_meet - now())) / 3600.0;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE plan_id = p_plan_id ORDER BY created_at DESC LIMIT 1;

  v_pattern := COALESCE(v_escrow.escrow_pattern::text, v_plan.escrow_pattern::text, 'A');
  v_total := COALESCE(v_escrow.amount_cents, v_plan.agreed_price_cents, v_offer.amount_cents, 0);
  IF v_total < 0 THEN v_total := 0; END IF;

  v_host_share := COALESCE(v_escrow.host_share_cents, CASE WHEN v_pattern = 'C' THEN 0 ELSE v_total END);
  v_guest_share := COALESCE(v_escrow.guest_share_cents, CASE WHEN v_pattern = 'A' THEN 0 ELSE v_total END);
  IF v_pattern = 'B' AND v_host_share + v_guest_share = 0 THEN
    v_host_share := FLOOR(v_total / 2);
    v_guest_share := v_total - v_host_share;
  END IF;

  IF v_escrow.id IS NOT NULL AND v_escrow.status IN ('funded', 'active') THEN
    IF v_pattern = 'B' THEN
      IF v_escrow.host_funded_at IS NOT NULL THEN v_host_paid := v_host_share; END IF;
      IF v_escrow.guest_funded_at IS NOT NULL THEN v_guest_paid := v_guest_share; END IF;
    ELSIF v_pattern = 'C' THEN
      v_guest_paid := v_total;
    ELSE
      v_host_paid := v_total;
    END IF;
  END IF;

  IF p_no_show THEN
    v_type := 'no_show';
    IF v_role = 'host' THEN
      v_guest_credit := 0;
      v_host_credit := v_host_paid + v_guest_paid;
      UPDATE public.users SET no_show_count = no_show_count + 1 WHERE id = v_guest_id;
    ELSE
      v_guest_credit := v_host_paid + v_guest_paid;
      v_host_credit := 0;
      PERFORM public._record_plan_cancellation_strikes(v_host_id, 2, 'host_no_show');
    END IF;
  ELSIF v_role = 'guest' THEN
    v_type := 'late';
    v_guest_credit := 0;
    v_host_credit := v_host_paid + v_guest_paid;
  ELSE
    IF v_hours >= 72 THEN
      v_type := 'early';
      v_band := '72_plus';
      v_guest_bps := 0;
      v_strikes := 0;
    ELSIF v_hours >= 48 THEN
      v_type := 'late';
      v_band := '48_72';
      v_guest_bps := 3000;
      v_strikes := 1;
    ELSIF v_hours >= 24 THEN
      v_type := 'late';
      v_band := '24_48';
      v_guest_bps := 5000;
      v_strikes := 1;
    ELSE
      v_type := 'late';
      v_band := 'under_24';
      v_guest_bps := 7000;
      v_strikes := 2;
    END IF;

    IF v_pattern = 'B' THEN
      v_guest_credit := v_guest_paid + FLOOR((v_host_paid * v_guest_bps) / 10000.0);
      v_host_credit := v_host_paid - FLOOR((v_host_paid * v_guest_bps) / 10000.0);
    ELSE
      v_guest_credit := FLOOR(((v_host_paid + v_guest_paid) * v_guest_bps) / 10000.0);
      v_host_credit := (v_host_paid + v_guest_paid) - v_guest_credit;
    END IF;

    IF v_strikes > 0 THEN
      PERFORM public._record_plan_cancellation_strikes(v_host_id, v_strikes, 'host_cancel:' || v_band);
    ELSIF v_band = '72_plus' THEN
      PERFORM public.create_notification(
        v_host_id,
        'strike_added',
        'Cancellation logged',
        'You cancelled with 72+ hours notice. A warning was recorded — please keep commitments when guests have secured payment.',
        jsonb_build_object('plan_id', p_plan_id, 'band', v_band),
        'medium',
        'host_cancel_warn:' || p_plan_id::text
      );
    END IF;
  END IF;

  IF (v_role = 'host' AND NOT p_no_show AND v_hours < 48)
     OR (v_role = 'guest' AND p_no_show) THEN
    v_goodwill_base := LEAST(3000, GREATEST(200, FLOOR(GREATEST(v_guest_credit, 1) * 0.08)));
    v_goodwill := public.goodwill_credit_amount(v_guest_id, v_goodwill_base);
    v_goodwill_user := v_guest_id;
  END IF;

  INSERT INTO public.cancellations (plan_id, user_id, role, cancel_type, refund_amount, fee_amount, goodwill_credit_amount)
  VALUES (p_plan_id, v_uid, v_role, v_type, v_guest_credit, v_host_credit, COALESCE(v_goodwill, 0));

  UPDATE public.plan_offers SET status = 'declined' WHERE id = v_offer.id;
  UPDATE public.plans SET status = 'cancelled' WHERE id = p_plan_id;

  IF v_escrow.id IS NOT NULL AND v_escrow.status IN ('funded', 'active') THEN
    UPDATE public.escrow_transactions
    SET status = 'refunded', updated_at = now()
    WHERE id = v_escrow.id;

    IF v_guest_credit > 0 AND v_guest_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_guest_id,
        v_guest_credit,
        'refund',
        v_escrow.id::text || ':guest',
        jsonb_build_object('plan_id', p_plan_id, 'cancel_type', v_type, 'role', v_role)
      );
    END IF;
    IF v_host_credit > 0 AND v_host_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_host_id,
        v_host_credit,
        'refund',
        v_escrow.id::text || ':host',
        jsonb_build_object('plan_id', p_plan_id, 'cancel_type', v_type, 'role', v_role)
      );
    END IF;

    PERFORM public.append_financial_event(
      v_guest_id,
      'escrow_refunded',
      v_guest_credit,
      'escrow:' || v_escrow.id::text || ':cancel_guest',
      jsonb_build_object('plan_id', p_plan_id, 'host_credit_cents', v_host_credit)
    );
  ELSIF v_escrow.id IS NOT NULL AND v_escrow.status = 'pending_funding' THEN
    UPDATE public.escrow_transactions SET status = 'cancelled', updated_at = now() WHERE id = v_escrow.id;
  END IF;

  IF v_goodwill > 0 AND v_goodwill_user IS NOT NULL THEN
    PERFORM public._goodwill_issue_internal(v_goodwill_user, v_goodwill, 'cancellation', p_plan_id::text);
  END IF;

  PERFORM public.append_financial_event(
    v_uid,
    'cancellation',
    v_guest_credit + v_host_credit,
    'cancel:' || p_plan_id::text || ':' || v_uid::text,
    jsonb_build_object(
      'role', v_role,
      'cancel_type', v_type,
      'guest_credit', v_guest_credit,
      'host_credit', v_host_credit,
      'band', v_band,
      'no_show', p_no_show,
      'goodwill_credit', COALESCE(v_goodwill, 0)
    )
  );

  PERFORM public.create_notification(
    v_guest_id,
    'plan_cancelled',
    'Plan cancelled',
    'A meetup you were matched on was cancelled. Open the app for refund and timing details.',
    jsonb_build_object('plan_id', p_plan_id),
    'high',
    NULL
  );
  PERFORM public.create_notification(
    v_host_id,
    'plan_cancelled',
    'Plan cancelled',
    'A meetup was cancelled. Open the app for refund and timing details.',
    jsonb_build_object('plan_id', p_plan_id),
    'high',
    NULL
  );

  RETURN jsonb_build_object(
    'cancel_type', v_type,
    'refund_amount', v_guest_credit,
    'fee_amount', v_host_credit,
    'guest_credit', v_guest_credit,
    'host_credit', v_host_credit,
    'goodwill_credit', COALESCE(v_goodwill, 0),
    'band', v_band
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_plan_cancellation(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_plan_cancellation(UUID, BOOLEAN) TO authenticated;
