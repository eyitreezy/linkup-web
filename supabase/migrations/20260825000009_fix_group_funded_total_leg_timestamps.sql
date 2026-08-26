-- Fix funded-total calculation: host/guest legs can be status=funded without *_funded_at set.
-- Without this, remaining completion ignores the host's prior payment and over-charges on top-up.

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

GRANT EXECUTE ON FUNCTION public._group_plan_funded_total_cents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._group_host_share_paid_cents(UUID) TO authenticated;

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
