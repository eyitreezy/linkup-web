-- ROOT CAUSE: plans.host_escrow_id pointed at the pending top-up row (182b5a3d…)
-- instead of the funded primary host escrow (c6e7ed28…).
-- Reconcile then "updated" the pending row to full host_share_needed (~₦166k)
-- and RETURNed before setting host_share_top_up metadata.

-- Backfill funded timestamps (idempotent)
UPDATE public.escrow_transactions e
SET host_funded_at = COALESCE(e.host_funded_at, e.funded_at, e.updated_at, NOW()),
    updated_at = NOW()
WHERE e.guest_id IS NULL
  AND e.status IN ('funded', 'active', 'released')
  AND e.host_funded_at IS NULL
  AND COALESCE(e.host_share_cents, 0) > 0;

-- Point host_escrow_id at the funded primary host leg, never the pending top-up.
UPDATE public.plans p
SET host_escrow_id = sub.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (e.plan_id)
    e.plan_id,
    e.id
  FROM public.escrow_transactions e
  WHERE e.guest_id IS NULL
    AND e.status IN ('funded', 'active', 'released')
    AND COALESCE(e.host_share_cents, 0) > 0
  ORDER BY e.plan_id, e.created_at ASC
) sub
WHERE p.id = sub.plan_id
  AND COALESCE(p.is_group_plan, false)
  AND (
    p.host_escrow_id IS NULL
    OR p.host_escrow_id <> sub.id
  );

CREATE OR REPLACE FUNCTION public._group_primary_funded_host_escrow(p_plan_id UUID)
RETURNS public.escrow_transactions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.escrow_transactions%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.escrow_transactions e
  WHERE e.plan_id = p_plan_id
    AND e.guest_id IS NULL
    AND e.status IN ('funded', 'active', 'released')
    AND COALESCE(e.host_share_cents, 0) > 0
  ORDER BY e.created_at ASC
  LIMIT 1;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public._group_host_share_paid_cents(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _primary public.escrow_transactions%ROWTYPE;
  _paid BIGINT := 0;
BEGIN
  _primary := public._group_primary_funded_host_escrow(p_plan_id);
  IF _primary.id IS NOT NULL THEN
    RETURN GREATEST(0, COALESCE(_primary.host_share_cents, 0)::BIGINT);
  END IF;

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

CREATE OR REPLACE FUNCTION public.reconcile_group_host_share_after_guest_remove(p_plan_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _primary_host public.escrow_transactions%ROWTYPE;
  _pending_host public.escrow_transactions%ROWTYPE;
  _host_share_needed BIGINT;
  _host_share_paid BIGINT;
  _outstanding BIGINT;
  _gross INT;
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

  UPDATE public.plans
  SET group_closed_at = NULL, updated_at = NOW()
  WHERE id = p_plan_id AND group_closed_at IS NOT NULL;

  _primary_host := public._group_primary_funded_host_escrow(p_plan_id);

  IF _primary_host.id IS NOT NULL THEN
    UPDATE public.plans
    SET host_escrow_id = _primary_host.id, updated_at = NOW()
    WHERE id = p_plan_id
      AND host_escrow_id IS DISTINCT FROM _primary_host.id;
  END IF;

  _host_share_needed := public._group_host_share_needed_cents(_plan);
  _host_share_paid := public._group_host_share_paid_cents(p_plan_id);
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

  -- Host never paid initial share: update the single pending primary leg only.
  IF _primary_host.id IS NULL THEN
    IF _pending_host.id IS NOT NULL THEN
      _gross := public.gross_amount_cents(_host_share_needed::INT)::INT;
      UPDATE public.escrow_transactions
      SET
        host_share_cents = LEAST(GREATEST(_host_share_needed, 0), 2147483647)::INT,
        guest_share_cents = 0,
        amount_cents = _gross,
        updated_at = NOW()
      WHERE id = _pending_host.id;
    END IF;
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
        'outstanding_budget_cents', _outstanding,
        'primary_host_escrow_id', _primary_host.id
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
      'outstanding_budget_cents', _outstanding,
      'primary_host_escrow_id', _primary_host.id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._group_primary_funded_host_escrow(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._group_host_share_paid_cents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_group_host_share_after_guest_remove(UUID) TO authenticated;

-- Apply to every open-slot group plan (including Lagos Shutdown).
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
