-- Guest opt-out must NOT cancel the entire group plan.
-- Minimum-membership cancellation belongs to submit_host_minimum_action / T-48h cron only.

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

  PERFORM public.reconcile_group_host_share_after_guest_remove(p_plan_id);
  PERFORM public.revalidate_group_plan_activation(p_plan_id);

  _plan_title := COALESCE(NULLIF(trim(_plan.title), ''), 'the group plan');

  PERFORM public.create_notification(
    _plan.creator_id,
    'group_plan_guest_opted_out',
    'Guest opted out',
    format('A guest opted out of "%s". Their slot is now available.', _plan_title),
    jsonb_build_object('href', '/plan/' || p_plan_id::text, 'planId', p_plan_id::text),
    'medium',
    NULL
  );

  RETURN jsonb_build_object(
    'opted_out', true,
    'triggered_minimum_cancel', false,
    'refund_cents', _refund_cents,
    'available_slots', public.get_plan_available_slots(p_plan_id),
    'terms', _terms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_opt_out(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
