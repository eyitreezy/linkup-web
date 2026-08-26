-- Fix _group_plan_total_cents: plans has no total_amount_cents column.
-- Delegates to plan_total_cost_cents (authoritative helper already used elsewhere).

CREATE OR REPLACE FUNCTION public._group_plan_total_cents(p_plan public.plans)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN GREATEST(0, public.plan_total_cost_cents(p_plan)::BIGINT);
END;
$$;

-- Backfill host top-up escrows for group plans that already had guests removed
-- before reconcile_group_host_share_after_guest_remove existed or was applied.

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
          AND e.status NOT IN ('cancelled', 'refunded')
      )
  LOOP
    PERFORM public.revalidate_group_plan_activation(_plan_id);
  END LOOP;
END;
$$;
