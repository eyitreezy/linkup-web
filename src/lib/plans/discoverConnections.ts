import type { SupabaseClient } from '@supabase/supabase-js';

/** MVP friends visibility: creators the viewer has an agreed/active/completed plan with. */
export async function fetchConnectedCreatorIds(
  client: SupabaseClient,
  viewerUserId: string
): Promise<string[]> {
  const connected = new Set<string>();

  const { data: hosted } = await client
    .from('plans')
    .select('accepted_offer_id')
    .eq('creator_id', viewerUserId)
    .in('status', ['agreed', 'active', 'completed'])
    .not('accepted_offer_id', 'is', null);

  const offerIds = [...new Set((hosted ?? []).map((r) => r.accepted_offer_id as string).filter(Boolean))];
  if (offerIds.length > 0) {
    const { data: offers } = await client
      .from('plan_offers')
      .select('bidder_id')
      .in('id', offerIds);
    for (const o of offers ?? []) {
      if (o.bidder_id) connected.add(o.bidder_id as string);
    }
  }

  const { data: guestOffers } = await client
    .from('plan_offers')
    .select('plan_id, plans!inner(creator_id, status)')
    .eq('bidder_id', viewerUserId)
    .eq('status', 'accepted');

  for (const row of guestOffers ?? []) {
    const plan = row.plans as { creator_id?: string; status?: string } | null;
    if (
      plan?.creator_id &&
      plan.status &&
      ['agreed', 'active', 'completed'].includes(plan.status)
    ) {
      connected.add(plan.creator_id);
    }
  }

  return [...connected];
}
