import type { DbPlan, DbPlanJoinRequest, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export function joinRequestSlotCents(plan: Pick<DbPlan, 'is_group_plan' | 'current_suggested_share_cents' | 'starting_price_cents' | 'agreed_price_cents'>): number {
  if (plan.is_group_plan) {
    return plan.current_suggested_share_cents ?? plan.starting_price_cents ?? 0;
  }
  return plan.agreed_price_cents ?? plan.starting_price_cents ?? 0;
}

export function syntheticOfferFromJoinRequest(
  plan: DbPlan,
  joinRequest: DbPlanJoinRequest
): DbPlanOffer {
  const slotCents = joinRequestSlotCents(plan);
  return {
    id: joinRequest.id,
    plan_id: plan.id,
    bidder_id: joinRequest.requester_id,
    amount_cents: slotCents,
    current_amount_cents: slotCents,
    message: joinRequest.message,
    status: 'accepted',
    round: 0,
    expires_at: null,
    proposed_scheduled_at: plan.agreed_scheduled_at ?? plan.scheduled_at,
    proposed_location: plan.agreed_location ?? plan.location_label,
    created_at: joinRequest.created_at,
    updated_at: joinRequest.updated_at,
  };
}

/** Join-request ids are used as synthetic offer ids for non-negotiable group plans. */
export function isSyntheticJoinRequestOffer(
  plan: Pick<DbPlan, 'is_negotiable' | 'is_group_plan'>
): boolean {
  return plan.is_negotiable === false && !!plan.is_group_plan;
}

export async function fetchApprovedJoinRequestOffers(
  client: SupabaseClient,
  plan: DbPlan
): Promise<DbPlanOffer[]> {
  const { data: joinRows } = await client
    .from('plan_join_requests')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  return (joinRows ?? []).map((row) =>
    syntheticOfferFromJoinRequest(plan, row as DbPlanJoinRequest)
  );
}
