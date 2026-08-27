-- Fix host top-up amount after guest removal:
-- 1) Use (host_share_needed - host_share_paid) in budget cents — one removed slot, not double-charging.
-- 2) Match ANY pending host-only escrow (metadata flag was missing on existing rows).

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

  _host_share_needed := public._group_host_share_needed_cents(_plan);
  _host_share_paid := public._group_host_share_paid_cents(p_plan_id);
  _outstanding := GREATEST(0, _host_share_needed - _host_share_paid);

  -- Drop stale duplicate pending host-only rows (keep the newest).
  UPDATE public.escrow_transactions e
  SET status = 'cancelled', updated_at = NOW()
  WHERE e.plan_id = p_plan_id
    AND e.guest_id IS NULL
    AND e.payer_id = _plan.creator_id
    AND e.status = 'pending_funding'
    AND e.id NOT IN (
      SELECT id
      FROM public.escrow_transactions
      WHERE plan_id = p_plan_id
        AND guest_id IS NULL
        AND payer_id = _plan.creator_id
        AND status = 'pending_funding'
      ORDER BY created_at DESC
      LIMIT 1
    );

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
      AND _primary_host.host_funded_at IS NULL
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

  IF _host_share_paid <= 0 THEN
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

-- Reconcile all open-slot group plans (fixes Lagos Shutdown top-up amount).
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
    PERFORM public.revalidate_group_plan_activation(_plan_id);
  END LOOP;
END;
$$;
