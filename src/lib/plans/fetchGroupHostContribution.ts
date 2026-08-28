import type { GroupHostShareResolution } from '@/lib/plans/groupDynamicSplit';
import type { SupabaseClient } from '@supabase/supabase-js';

export type GroupHostContributionRow = {
  budget_cents: number;
  gross_checkout_cents: number;
  guest_commitment_cents: number;
  guest_gross_cents: number;
  plan_total_budget_cents: number;
};

function parseContributionRow(raw: unknown): GroupHostContributionRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const budget = Number(row.budget_cents ?? 0);
  const gross = Number(row.gross_checkout_cents ?? 0);
  if (budget <= 0 && gross <= 0) return null;
  return {
    budget_cents: Math.max(0, budget),
    gross_checkout_cents: Math.max(0, gross),
    guest_commitment_cents: Math.max(0, Number(row.guest_commitment_cents ?? 0)),
    guest_gross_cents: Math.max(0, Number(row.guest_gross_cents ?? 0)),
    plan_total_budget_cents: Math.max(0, Number(row.plan_total_budget_cents ?? 0)),
  };
}

/** Server-authoritative host share for group split plans (falls back to null if RPC missing). */
export async function fetchGroupHostContribution(
  client: SupabaseClient,
  planId: string
): Promise<GroupHostShareResolution | null> {
  const { data, error } = await client.rpc('get_group_host_contribution', {
    p_plan_id: planId,
  });
  if (error) {
    console.warn('[fetchGroupHostContribution]', planId, error.message);
    return null;
  }
  const row = parseContributionRow(data);
  if (!row) return null;
  return {
    displayCents: row.budget_cents,
    paymentCents: row.gross_checkout_cents,
  };
}
