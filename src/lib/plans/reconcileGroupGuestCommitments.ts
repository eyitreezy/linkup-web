import type { SupabaseClient } from '@supabase/supabase-js';

export type ReconcileGroupGuestCommitmentsResult = {
  accepted_guest_count: number;
  accepted_guest_amounts_sum_cents: number;
  previous_accepted_guest_count: number;
  previous_accepted_guest_amounts_sum_cents: number;
  host_share_budget_cents: number;
};

/** Sync plan guest commitment columns from accepted offers and refresh host escrow. */
export async function reconcileGroupPlanGuestCommitments(
  client: SupabaseClient,
  planId: string
): Promise<ReconcileGroupGuestCommitmentsResult | null> {
  const { data, error } = await client.rpc('reconcile_group_plan_guest_commitments', {
    p_plan_id: planId,
  });
  if (error) {
    console.warn('[reconcileGroupPlanGuestCommitments]', planId, error.message);
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    accepted_guest_count: Number(row.accepted_guest_count ?? 0),
    accepted_guest_amounts_sum_cents: Number(row.accepted_guest_amounts_sum_cents ?? 0),
    previous_accepted_guest_count: Number(row.previous_accepted_guest_count ?? 0),
    previous_accepted_guest_amounts_sum_cents: Number(
      row.previous_accepted_guest_amounts_sum_cents ?? 0
    ),
    host_share_budget_cents: Number(row.host_share_budget_cents ?? 0),
  };
}
