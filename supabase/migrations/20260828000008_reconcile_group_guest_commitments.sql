-- Reconcile group plan guest commitment columns from accepted offers (source of truth).
-- Fixes stale accepted_guest_amounts_sum_cents / accepted_guest_count drift.
-- Includes refresh_group_host_close_escrow_share (requires 000006 or this block).

CREATE OR REPLACE FUNCTION public.refresh_group_host_close_escrow_share(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _host_escrow public.escrow_transactions%ROWTYPE;
  _needed BIGINT;
  _gross INT;
  _caller UUID := auth.uid();
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF _caller IS NOT NULL AND _plan.creator_id IS DISTINCT FROM _caller THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false)
    OR COALESCE(_plan.escrow_pattern::text, '') IS DISTINCT FROM 'B' THEN
    RETURN FALSE;
  END IF;

  IF _plan.host_escrow_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO _host_escrow
  FROM public.escrow_transactions
  WHERE id = _plan.host_escrow_id
    AND plan_id = p_plan_id
    AND guest_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF _host_escrow.status::text IS DISTINCT FROM 'pending_funding' THEN
    RETURN FALSE;
  END IF;

  IF public.escrow_funding_complete(_host_escrow) THEN
    RETURN FALSE;
  END IF;

  _needed := public._group_host_share_needed_cents(_plan);
  IF _needed <= 0 THEN
    RETURN FALSE;
  END IF;

  _gross := public.gross_amount_cents(_needed::INT)::INT;

  IF COALESCE(_host_escrow.host_share_cents, 0) = _needed::INT
    AND COALESCE(_host_escrow.amount_cents, 0) = _gross THEN
    RETURN FALSE;
  END IF;

  UPDATE public.escrow_transactions
  SET
    host_share_cents = _needed::INT,
    guest_share_cents = 0,
    amount_cents = _gross,
    updated_at = NOW()
  WHERE id = _host_escrow.id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_group_host_close_escrow_share(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_group_host_close_escrow_share(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public._sum_accepted_guest_commitments_cents(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      GREATEST(0, COALESCE(o.current_amount_cents, o.amount_cents, 0)::BIGINT)
    ),
    0
  )
  FROM public.plan_offers o
  WHERE o.plan_id = p_plan_id
    AND o.status = 'accepted'::public.offer_status;
$$;

CREATE OR REPLACE FUNCTION public._count_accepted_guest_offers(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.plan_offers o
  WHERE o.plan_id = p_plan_id
    AND o.status = 'accepted'::public.offer_status;
$$;

CREATE OR REPLACE FUNCTION public._group_host_share_needed_cents(p_plan public.plans)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _total BIGINT;
  _guest_sum BIGINT;
BEGIN
  _total := public._group_plan_total_cents(p_plan);
  _guest_sum := public._sum_accepted_guest_commitments_cents(p_plan.id);
  IF _guest_sum <= 0 THEN
    _guest_sum := GREATEST(0, COALESCE(p_plan.accepted_guest_amounts_sum_cents, 0)::BIGINT);
  END IF;
  RETURN GREATEST(0, _total - _guest_sum);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_group_plan_guest_commitments(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _caller UUID := auth.uid();
  _offer_count INT;
  _offer_sum BIGINT;
  _prev_count INT;
  _prev_sum BIGINT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _caller IS NOT NULL AND _plan.creator_id IS DISTINCT FROM _caller THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  _offer_count := public._count_accepted_guest_offers(p_plan_id);
  _offer_sum := public._sum_accepted_guest_commitments_cents(p_plan_id);
  _prev_count := COALESCE(_plan.accepted_guest_count, 0);
  _prev_sum := COALESCE(_plan.accepted_guest_amounts_sum_cents, 0)::BIGINT;

  UPDATE public.plans
  SET
    accepted_guest_count = _offer_count,
    accepted_guest_amounts_sum_cents = _offer_sum,
    current_suggested_share_cents = public.calculate_group_suggested_share(p_plan_id),
    updated_at = NOW()
  WHERE id = p_plan_id;

  PERFORM public.refresh_group_host_close_escrow_share(p_plan_id);

  RETURN jsonb_build_object(
    'accepted_guest_count', _offer_count,
    'accepted_guest_amounts_sum_cents', _offer_sum,
    'previous_accepted_guest_count', _prev_count,
    'previous_accepted_guest_amounts_sum_cents', _prev_sum,
    'host_share_budget_cents', GREATEST(0, public._group_plan_total_cents(_plan) - _offer_sum)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._sum_accepted_guest_commitments_cents(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._count_accepted_guest_offers(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_group_plan_guest_commitments(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_group_plan_guest_commitments(UUID) TO authenticated;

-- VGC Outing: repair plan columns + host escrow from accepted offers.
SELECT public.reconcile_group_plan_guest_commitments(
  'fb662ca8-aaf3-4c23-a50a-270de1f3174a'::UUID
);

NOTIFY pgrst, 'reload schema';
