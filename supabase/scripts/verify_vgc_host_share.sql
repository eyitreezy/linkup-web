-- Verify group host contribution for VGC Outing
-- Plan: fb662ca8-aaf3-4c23-a50a-270de1f3174a
-- Run in Supabase SQL Editor (read-only diagnostics).

WITH plan_row AS (
  SELECT *
  FROM public.plans
  WHERE id = 'fb662ca8-aaf3-4c23-a50a-270de1f3174a'
),
guest_escrows AS (
  SELECT
    e.guest_id,
    e.status,
    e.guest_share_cents,
    e.amount_cents AS paid_gross_cents,
    e.guest_funded_at,
    public.escrow_funding_complete(e) AS is_funded
  FROM public.escrow_transactions e
  WHERE e.plan_id = 'fb662ca8-aaf3-4c23-a50a-270de1f3174a'
    AND e.guest_id IS NOT NULL
    AND e.status NOT IN ('cancelled', 'refunded')
),
accepted_offers AS (
  SELECT
    o.bidder_id,
    COALESCE(o.current_amount_cents, o.amount_cents, 0) AS budget_cents
  FROM public.plan_offers o
  WHERE o.plan_id = 'fb662ca8-aaf3-4c23-a50a-270de1f3174a'
    AND o.status = 'accepted'::public.offer_status
),
guest_gross AS (
  SELECT
    COALESCE(SUM(
      CASE
        WHEN ge.is_funded AND ge.paid_gross_cents > 0 THEN ge.paid_gross_cents
        ELSE public.gross_amount_cents(ao.budget_cents::INT)::BIGINT
      END
    ), 0) AS total_guest_gross_cents
  FROM accepted_offers ao
  LEFT JOIN guest_escrows ge ON ge.guest_id = ao.bidder_id
),
calc AS (
  SELECT
    p.id,
    p.title,
    p.status,
    p.group_closed_at,
    p.host_escrow_id,
    p.accepted_guest_count,
    p.max_guests,
    public.plan_total_cost_cents(p) AS plan_total_budget_cents,
    COALESCE(p.accepted_guest_amounts_sum_cents, 0) AS guest_commitment_sum_cents,
    public._group_host_share_needed_cents(p) AS host_budget_cents,
    public.gross_amount_cents(public._group_host_share_needed_cents(p)::INT) AS host_gross_per_leg_cents,
    gg.total_guest_gross_cents,
    GREATEST(
      0,
      public.gross_amount_cents(public.plan_total_cost_cents(p)::INT)::BIGINT
        - gg.total_guest_gross_cents
    ) AS host_checkout_pool_cents
  FROM plan_row p
  CROSS JOIN guest_gross gg
)
SELECT
  title,
  status,
  group_closed_at IS NOT NULL AS group_closed,
  host_escrow_id,
  accepted_guest_count,
  max_guests,
  plan_total_budget_cents / 100.0 AS plan_total_budget_ngn,
  guest_commitment_sum_cents / 100.0 AS guest_commitments_ngn,
  host_budget_cents / 100.0 AS host_share_budget_ngn,
  host_gross_per_leg_cents / 100.0 AS host_checkout_per_leg_ngn,
  total_guest_gross_cents / 100.0 AS funded_guest_gross_ngn,
  host_checkout_pool_cents / 100.0 AS host_checkout_pool_ngn,
  CASE
    WHEN host_checkout_pool_cents = 24499900 THEN 'OK: matches expected 244999 NGN'
    ELSE 'CHECK: expected 244999 NGN at checkout when 3 guests funded'
  END AS vgc_expectation
FROM calc;

-- Guest-level detail
SELECT
  pr.display_name,
  ao.budget_cents / 100.0 AS commitment_ngn,
  ge.status AS escrow_status,
  ge.paid_gross_cents / 100.0 AS paid_gross_ngn,
  ge.is_funded
FROM accepted_offers ao
LEFT JOIN guest_escrows ge ON ge.guest_id = ao.bidder_id
LEFT JOIN public.profiles pr ON pr.user_id = ao.bidder_id
ORDER BY ao.budget_cents;

-- Host escrow leg (if group closed)
SELECT
  e.id,
  e.status,
  e.host_share_cents / 100.0 AS host_budget_ngn,
  e.amount_cents / 100.0 AS checkout_gross_ngn,
  e.host_funded_at
FROM public.escrow_transactions e
WHERE e.plan_id = 'fb662ca8-aaf3-4c23-a50a-270de1f3174a'
  AND e.guest_id IS NULL
  AND e.status NOT IN ('cancelled', 'refunded')
ORDER BY e.created_at DESC;
