-- SQL editor + authenticated: get_group_host_contribution auth fallback for diagnostics.

CREATE OR REPLACE FUNCTION public.get_group_host_contribution(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _viewer UUID := auth.uid();
  _total_budget BIGINT;
  _guest_commitment BIGINT;
  _host_budget BIGINT;
  _guest_gross BIGINT := 0;
  _offer RECORD;
  _escrow public.escrow_transactions%ROWTYPE;
  _guest_gross_leg BIGINT;
  _host_gross BIGINT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _viewer IS NULL THEN
    IF current_setting('request.jwt.claim.sub', true) IS NULL THEN
      _viewer := _plan.creator_id;
    END IF;
    IF _viewer IS NULL THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF _plan.creator_id IS DISTINCT FROM _viewer
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_offers o
      WHERE o.plan_id = p_plan_id
        AND o.bidder_id = _viewer
        AND o.status = 'accepted'::public.offer_status
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_join_requests jr
      WHERE jr.plan_id = p_plan_id
        AND jr.requester_id = _viewer
        AND jr.status = 'approved'::public.join_request_status
    ) THEN
    RAISE EXCEPTION 'not_plan_party';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false)
    OR COALESCE(_plan.escrow_pattern::text, '') IS DISTINCT FROM 'B' THEN
    RETURN jsonb_build_object(
      'budget_cents', 0,
      'gross_checkout_cents', 0,
      'guest_commitment_cents', 0,
      'guest_gross_cents', 0,
      'plan_total_budget_cents', 0
    );
  END IF;

  _total_budget := public._group_plan_total_cents(_plan);
  _guest_commitment := public._sum_accepted_guest_commitments_cents(p_plan_id);
  IF _guest_commitment <= 0 THEN
    _guest_commitment := GREATEST(0, COALESCE(_plan.accepted_guest_amounts_sum_cents, 0)::BIGINT);
  END IF;
  _host_budget := GREATEST(0, _total_budget - _guest_commitment);

  FOR _offer IN
    SELECT
      o.bidder_id,
      GREATEST(0, COALESCE(o.current_amount_cents, o.amount_cents, 0)::BIGINT) AS budget_cents
    FROM public.plan_offers o
    WHERE o.plan_id = p_plan_id
      AND o.status = 'accepted'::public.offer_status
  LOOP
    _guest_gross_leg := 0;

    SELECT e.*
    INTO _escrow
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.guest_id = _offer.bidder_id
      AND e.status NOT IN ('cancelled', 'refunded')
    ORDER BY
      (CASE WHEN public.escrow_funding_complete(e) THEN 0 ELSE 1 END),
      e.created_at DESC
    LIMIT 1;

    IF FOUND AND public.escrow_funding_complete(_escrow) AND COALESCE(_escrow.amount_cents, 0) > 0 THEN
      _guest_gross_leg := _escrow.amount_cents::BIGINT;
    ELSIF _offer.budget_cents > 0 THEN
      _guest_gross_leg := public.gross_amount_cents(_offer.budget_cents::INT)::BIGINT;
    END IF;

    _guest_gross := _guest_gross + _guest_gross_leg;
  END LOOP;

  IF _guest_gross > 0 AND _total_budget > 0 THEN
    _host_gross := GREATEST(
      0,
      public.gross_amount_cents(_total_budget::INT)::BIGINT - _guest_gross
    );
  ELSIF _host_budget > 0 THEN
    _host_gross := public.gross_amount_cents(_host_budget::INT)::BIGINT;
  ELSE
    _host_gross := 0;
  END IF;

  RETURN jsonb_build_object(
    'budget_cents', _host_budget,
    'gross_checkout_cents', _host_gross,
    'guest_commitment_cents', _guest_commitment,
    'guest_gross_cents', _guest_gross,
    'plan_total_budget_cents', _total_budget
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_host_contribution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_host_contribution(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
