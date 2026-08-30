import { fetchApprovedJoinRequestOffers, joinRequestSlotCents } from '@/lib/plans/joinRequestOffers';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

function syntheticOfferFromInvitation(
  plan: DbPlan,
  row: Record<string, unknown>
): DbPlanOffer {
  const cents = joinRequestSlotCents(plan);
  return {
    id: `invitation-${row.id as string}`,
    plan_id: plan.id,
    bidder_id: row.invitee_user_id as string,
    amount_cents: cents,
    current_amount_cents: cents,
    message: null,
    status: 'accepted',
    round: 1,
    expires_at: null,
    proposed_scheduled_at: plan.scheduled_at ?? null,
    proposed_location: null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Active accepted roster for a group plan (join requests, invitations, offers). */
export async function fetchActiveGroupAcceptedOffers(
  client: SupabaseClient,
  plan: DbPlan
): Promise<DbPlanOffer[]> {
  if (!plan.is_group_plan) return [];

  const [{ data: inviteRows }, { data: offerRows }] = await Promise.all([
    client
      .from('plan_invitations')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('status', 'accepted')
      .not('invitee_user_id', 'is', null),
    plan.is_negotiable !== false
      ? client.from('plan_offers').select('*').eq('plan_id', plan.id).eq('status', 'accepted')
      : Promise.resolve({ data: [] as DbPlanOffer[] }),
  ]);

  const byUserId = new Map<string, DbPlanOffer>();

  if (plan.is_negotiable === false) {
    const joinOffers = await fetchApprovedJoinRequestOffers(client, plan);
    for (const offer of joinOffers) {
      byUserId.set(offer.bidder_id, offer);
    }
  }

  for (const row of inviteRows ?? []) {
    const bidderId = row.invitee_user_id as string | null;
    if (!bidderId || byUserId.has(bidderId)) continue;
    byUserId.set(bidderId, syntheticOfferFromInvitation(plan, row as Record<string, unknown>));
  }

  for (const offer of (offerRows ?? []) as DbPlanOffer[]) {
    if (!byUserId.has(offer.bidder_id)) {
      byUserId.set(offer.bidder_id, offer);
    }
  }

  return Array.from(byUserId.values());
}

export function activeGroupGuestUserIds(offers: DbPlanOffer[]): Set<string> {
  return new Set(offers.map((o) => o.bidder_id).filter(Boolean));
}
