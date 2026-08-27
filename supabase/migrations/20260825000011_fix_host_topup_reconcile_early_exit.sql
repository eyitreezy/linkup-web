-- Consolidated fix: host top-up was never rewritten because _host_share_paid returned 0
-- (host_funded_at missing) and reconcile exited before updating the pending row.

-- 1) Backfill leg timestamps on already-funded escrows
UPDATE public.escrow_transactions e
SET
  host_funded_at = COALESCE(e.host_funded_at, e.funded_at, e.updated_at, NOW()),
  updated_at = NOW()
WHERE e.guest_id IS NULL
  AND e.status IN ('funded', 'active', 'released')
  AND e.host_funded_at IS NULL
  AND GREATEST(0, COALESCE(e.host_share_cents, 0)::BIGINT) > 0;

UPDATE public.escrow_transactions e
SET
  guest_funded_at = COALESCE(e.guest_funded_at, e.funded_at, e.updated_at, NOW()),
  updated_at = NOW()
WHERE e.guest_id IS NOT NULL
  AND e.status IN ('funded', 'active', 'released')
  AND e.guest_funded_at IS NULL
  AND GREATEST(0, COALESCE(e.guest_share_cents, 0)::BIGINT) > 0;

-- 2) Count host paid legs by funding completion (not timestamp-only)
CREATE OR REPLACE FUNCTION public._group_host_share_paid_cents(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _paid BIGINT := 0;
BEGIN
  SELECT COALESCE(
    SUM(GREATEST(0, COALESCE(e.host_share_cents, 0)::BIGINT)),
    0
  )
  INTO _paid
  FROM public.escrow_transactions e
  WHERE e.plan_id = p_plan_id
    AND e.guest_id IS NULL
    AND e.status NOT IN ('cancelled', 'refunded')
    AND public.escrow_funding_complete(e);

  RETURN _paid;
END;
$$;

-- 3) Reconcile: needed − paid; never skip updating an existing pending top-up when primary host funded
CREATE OR REPLACE FUNCTION public.reconcile_group_host_share_after_guest_remove(p_plan_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _host_share_needed BIGINT;
  _host_share_paid BIGINT;
  _outstanding BIGINT;
  _pending_host public.escrow_transactions%ROWTYPE;
  _primary_host public.escrow_transactions%ROWTYPE;
  _gross INT;
  _primary_funded BOOLEAN := false;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN;
  END IF;

  IF NOT public.is_group_split_dynamic_plan(_plan)
    AND COALESCE(_plan.escrow_pattern::text, '') IS DISTINCT FROM 'B' THEN
    RETURN;
  END IF;

  IF COALESCE(_plan.accepted_guest_count, 0) >= COALESCE(_plan.max_guests, 0) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.guest_id IS NULL
      AND e.status NOT IN ('cancelled', 'refunded')
  ) THEN
    RETURN;
  END IF;

  UPDATE public.plans
  SET group_closed_at = NULL, updated_at = NOW()
  WHERE id = p_plan_id AND group_closed_at IS NOT NULL;

  IF _plan.host_escrow_id IS NOT NULL THEN
    SELECT * INTO _primary_host
    FROM public.escrow_transactions
    WHERE id = _plan.host_escrow_id;

    _primary_funded := FOUND AND public.escrow_funding_complete(_primary_host);
  END IF;

  _host_share_needed := public._group_host_share_needed_cents(_plan);
  _host_share_paid := public._group_host_share_paid_cents(p_plan_id);

  IF _host_share_paid <= 0 AND _primary_funded THEN
    _host_share_paid := GREATEST(0, COALESCE(_primary_host.host_share_cents, 0)::BIGINT);
  END IF;

  _outstanding := GREATEST(0, _host_share_needed - _host_share_paid);

  SELECT * INTO _pending_host
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id IS NULL
    AND payer_id = _plan.creator_id
    AND status = 'pending_funding'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _outstanding <= 0 THEN
    IF _pending_host.id IS NOT NULL THEN
      UPDATE public.escrow_transactions
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = _pending_host.id;
    END IF;
    RETURN;
  END IF;

  IF _plan.host_escrow_id IS NOT NULL THEN
    SELECT * INTO _primary_host
    FROM public.escrow_transactions
    WHERE id = _plan.host_escrow_id
    FOR UPDATE;

    IF FOUND
      AND NOT _primary_funded
      AND _primary_host.status = 'pending_funding'
      AND _primary_host.guest_id IS NULL THEN
      _gross := public.gross_amount_cents(_host_share_needed::INT)::INT;
      UPDATE public.escrow_transactions
      SET
        host_share_cents = LEAST(GREATEST(_host_share_needed, 0), 2147483647)::INT,
        guest_share_cents = 0,
        amount_cents = _gross,
        updated_at = NOW()
      WHERE id = _primary_host.id;
      RETURN;
    END IF;
  END IF;

  IF _host_share_paid <= 0 AND NOT _primary_funded THEN
    RETURN;
  END IF;

  _gross := public.gross_amount_cents(_outstanding::INT)::INT;

  IF _pending_host.id IS NOT NULL THEN
    UPDATE public.escrow_transactions
    SET
      host_share_cents = LEAST(GREATEST(_outstanding, 0), 2147483647)::INT,
      guest_share_cents = 0,
      amount_cents = _gross,
      updated_at = NOW(),
      metadata = COALESCE(_pending_host.metadata, '{}'::jsonb) || jsonb_build_object(
        'host_share_top_up', true,
        'reason', 'guest_removed',
        'host_share_needed_cents', _host_share_needed,
        'host_share_paid_cents', _host_share_paid,
        'outstanding_budget_cents', _outstanding
      )
    WHERE id = _pending_host.id;
    RETURN;
  END IF;

  INSERT INTO public.escrow_transactions (
    plan_id,
    payer_id,
    payee_id,
    host_id,
    guest_id,
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
    _plan.creator_id,
    _plan.creator_id,
    _plan.creator_id,
    NULL,
    _plan.escrow_pattern,
    _gross,
    LEAST(GREATEST(_outstanding, 0), 2147483647)::INT,
    0,
    CASE
      WHEN COALESCE(_plan.is_mood_plan, false) THEN NOW() + INTERVAL '1 hour'
      ELSE NOW() + INTERVAL '24 hours'
    END,
    COALESCE(_plan.currency, 'NGN'),
    'pending_funding',
    jsonb_build_object(
      'host_share_top_up', true,
      'reason', 'guest_removed',
      'host_share_needed_cents', _host_share_needed,
      'host_share_paid_cents', _host_share_paid,
      'outstanding_budget_cents', _outstanding
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._group_host_share_paid_cents(UUID) TO authenticated;

-- 4) Run reconcile directly (not only via revalidate)
DO $$
DECLARE
  _plan_id UUID;
BEGIN
  FOR _plan_id IN
    SELECT p.id
    FROM public.plans p
    WHERE COALESCE(p.is_group_plan, false)
      AND COALESCE(p.accepted_guest_count, 0) < COALESCE(p.max_guests, 0)
      AND p.status IN ('active', 'awaiting_payment')
  LOOP
    PERFORM public.reconcile_group_host_share_after_guest_remove(_plan_id);
    PERFORM public.revalidate_group_plan_activation(_plan_id);
  END LOOP;
END;
$$;
