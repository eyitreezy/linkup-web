-- Close group: create host escrow leg with gross checkout amount (budget + 5% fee).
-- Host share budget = plan_total_cost_cents - accepted_guest_amounts_sum_cents.

CREATE OR REPLACE FUNCTION public.close_group_and_create_host_escrow(p_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _host_id UUID := auth.uid();
  _host_share_cents BIGINT;
  _host_gross_cents INT;
  _host_escrow_id UUID;
  _guest RECORD;
  _idx INT;
BEGIN
  IF _host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id != _host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF NOT public.is_group_split_dynamic_plan(_plan) THEN
    RAISE EXCEPTION 'not_group_split_plan';
  END IF;

  IF COALESCE(_plan.accepted_guest_count, 0) = 0 THEN
    RAISE EXCEPTION 'no_guests_accepted';
  END IF;

  IF _plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  _host_share_cents := public._group_host_share_needed_cents(_plan);

  IF _host_share_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_host_share';
  END IF;

  _host_gross_cents := public.gross_amount_cents(_host_share_cents::INT)::INT;

  SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO _idx
  FROM public.escrow_transactions WHERE plan_id = p_plan_id;

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
  ) VALUES (
    p_plan_id,
    _host_id,
    _host_id,
    _host_id,
    NULL,
    _idx,
    'B',
    _host_gross_cents,
    _host_share_cents::INT,
    0,
    now() + interval '24 hours',
    COALESCE(_plan.currency, 'NGN'),
    'pending_funding',
    jsonb_build_object('leg', 'host_close', 'dynamic_group_split', true)
  )
  RETURNING id INTO _host_escrow_id;

  UPDATE public.plans
  SET
    group_closed_at = now(),
    host_escrow_id = _host_escrow_id,
    status = 'awaiting_payment'::public.plan_status,
    updated_at = now()
  WHERE id = p_plan_id;

  FOR _guest IN
    SELECT DISTINCT bidder_id FROM public.plan_offers
    WHERE plan_id = p_plan_id AND status = 'accepted'::public.offer_status
  LOOP
    PERFORM public.create_notification(
      _guest.bidder_id,
      'group_closed',
      'The host has closed the group',
      'Fund your share to confirm the meetup.',
      jsonb_build_object(
        'href', '/plan/' || p_plan_id || '/agreement',
        'planId', p_plan_id::text
      )
    );
  END LOOP;

  RETURN _host_escrow_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_group_and_create_host_escrow(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_group_and_create_host_escrow(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
