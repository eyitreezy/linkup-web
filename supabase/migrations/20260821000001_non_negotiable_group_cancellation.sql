-- Non-negotiable group plans use approved join requests, not plan_offers.accepted.
-- Extend group refund + host-cancel notifications to include join-request guests.

CREATE OR REPLACE FUNCTION public._refund_all_group_guests(
  p_plan_id UUID,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest UUID;
BEGIN
  FOR v_guest IN
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
    PERFORM public._refund_group_guest_escrow(p_plan_id, v_guest, p_refund_platform_fee);
  END LOOP;
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
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF _plan.creator_id <> _user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_a_group_plan'; END IF;

  _terms := public.get_cancellation_terms(p_plan_id, 'host', false);

  UPDATE public.plans
  SET status = 'cancelled',
      cancellation_reason_type = p_reason_type,
      cancellation_reason_text = p_reason_text,
      cancellation_timing_band = _terms->>'timing_band',
      cancellation_host_refund_percent = (_terms->>'canceller_refund_percent')::int,
      cancellation_guest_penalty_percent = (_terms->>'other_party_penalty_percent')::int,
      updated_at = NOW()
  WHERE id = p_plan_id;

  PERFORM public._apply_user_strikes(_user_id, COALESCE((_terms->>'trust_strikes')::int, 0));
  PERFORM public._refund_all_group_guests(p_plan_id, true);

  _goodwill := COALESCE(_terms->>'other_party_goodwill_credit', 'none');

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
