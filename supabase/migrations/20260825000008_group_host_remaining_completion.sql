-- Host top-up after guest removal: outstanding = plan total minus all funded legs
-- (remaining amount to complete the group), not a duplicate charge of the host's prior share.

CREATE OR REPLACE FUNCTION public._group_plan_funded_total_cents(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _guest BIGINT := 0;
  _host BIGINT := 0;
BEGIN
  SELECT COALESCE(
    SUM(
      GREATEST(
        0,
        COALESCE(
          NULLIF(e.guest_share_cents, 0),
          CASE WHEN e.guest_id IS NOT NULL THEN e.amount_cents ELSE 0 END,
          0
        )::BIGINT
      )
    ),
    0
  )
  INTO _guest
  FROM public.escrow_transactions e
  WHERE e.plan_id = p_plan_id
    AND e.guest_id IS NOT NULL
    AND e.status NOT IN ('cancelled', 'refunded')
    AND public.escrow_funding_complete(e);

  SELECT COALESCE(
    SUM(GREATEST(0, COALESCE(NULLIF(e.host_share_cents, 0), e.amount_cents, 0)::BIGINT)),
    0
  )
  INTO _host
  FROM public.escrow_transactions e
  WHERE e.plan_id = p_plan_id
    AND e.guest_id IS NULL
    AND e.status NOT IN ('cancelled', 'refunded')
    AND public.escrow_funding_complete(e);

  RETURN GREATEST(0, _guest + _host);
END;
$$;

CREATE OR REPLACE FUNCTION public._group_plan_remaining_completion_cents(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _total BIGINT;
  _funded BIGINT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  _total := public._group_plan_total_cents(_plan);
  _funded := public._group_plan_funded_total_cents(p_plan_id);
  RETURN GREATEST(0, _total - _funded);
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

  IF _host_share_paid > 0 THEN
    _outstanding := public._group_plan_remaining_completion_cents(p_plan_id);
  ELSE
    _outstanding := GREATEST(0, _host_share_needed - _host_share_paid);
  END IF;

  SELECT * INTO _pending_host
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id IS NULL
    AND payer_id = _plan.creator_id
    AND status = 'pending_funding'
    AND COALESCE(metadata->>'host_share_top_up', 'false') = 'true'
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
        'remaining_completion_cents', _outstanding
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
      'remaining_completion_cents', _outstanding
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._group_plan_funded_total_cents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._group_plan_remaining_completion_cents(UUID) TO authenticated;

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
      AND EXISTS (
        SELECT 1
        FROM public.escrow_transactions e
        WHERE e.plan_id = p.id
          AND e.guest_id IS NULL
          AND e.host_funded_at IS NOT NULL
          AND e.status NOT IN ('cancelled', 'refunded')
      )
  LOOP
    PERFORM public.revalidate_group_plan_activation(_plan_id);
  END LOOP;
END;
$$;
