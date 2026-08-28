import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type OfferDashboardRow = {
  offer: DbPlanOffer;
  plan: DbPlan;
  otherUserId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherVerified: boolean;
};

export type OfferDisplayStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export function getOfferDisplayStatus(offer: DbPlanOffer): OfferDisplayStatus {
  if (isOfferExpired(offer)) return 'expired';
  if (offer.status === 'accepted') return 'accepted';
  if (offer.status === 'declined' || offer.status === 'superseded' || offer.status === 'withdrawn') {
    return 'rejected';
  }
  if (offer.status === 'expired') return 'expired';
  return 'pending';
}

export async function fetchSentOffers(
  client: SupabaseClient,
  userId: string
): Promise<OfferDashboardRow[]> {
  const { data: offers, error } = await client
    .from('plan_offers')
    .select('*')
    .eq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return hydrateOfferRows(client, offers as DbPlanOffer[], userId, 'sent');
}

export async function fetchReceivedOffers(
  client: SupabaseClient,
  userId: string
): Promise<OfferDashboardRow[]> {
  const { data: myPlans, error: pErr } = await client.from('plans').select('id').eq('creator_id', userId);
  if (pErr) throw new Error(pErr.message);
  const pids = [...new Set((myPlans ?? []).map((p) => p.id as string))];
  if (pids.length === 0) return [];

  const { data: offers, error } = await client
    .from('plan_offers')
    .select('*')
    .in('plan_id', pids)
    .neq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return hydrateOfferRows(client, offers as DbPlanOffer[], userId, 'received');
}

async function hydrateOfferRows(
  client: SupabaseClient,
  offers: DbPlanOffer[],
  userId: string,
  direction: 'sent' | 'received'
): Promise<OfferDashboardRow[]> {
  if (offers.length === 0) return [];
  const planIds = [...new Set(offers.map((o) => o.plan_id))];
  const { data: plans, error: plErr } = await client.from('plans').select('*').in('id', planIds);
  if (plErr) throw new Error(plErr.message);
  const planById = new Map((plans as DbPlan[]).map((p) => [p.id, p]));

  const otherIds = [
    ...new Set(
      offers.map((o) => {
        const p = planById.get(o.plan_id);
        if (!p) return o.bidder_id;
        return direction === 'sent' ? p.creator_id : o.bidder_id;
      })
    ),
  ];

  const { data: profs, error: prErr } = await client
    .from('profiles')
    .select('user_id, display_name, avatar_url, verified_badge')
    .in('user_id', otherIds);
  if (prErr) throw new Error(prErr.message);
  const profByUser = new Map(
    (profs ?? []).map((r) => [
      r.user_id as string,
      {
        name: (r.display_name as string | null) ?? 'Member',
        avatar: r.avatar_url as string | null,
        verified: !!(r as { verified_badge?: boolean }).verified_badge,
      },
    ])
  );

  const out: OfferDashboardRow[] = [];
  for (const offer of offers) {
    const plan = planById.get(offer.plan_id);
    if (!plan) continue;
    const otherUserId = direction === 'sent' ? plan.creator_id : offer.bidder_id;
    const pr = profByUser.get(otherUserId);
    out.push({
      offer,
      plan,
      otherUserId,
      otherName: pr?.name ?? 'Member',
      otherAvatarUrl: pr?.avatar ?? null,
      otherVerified: pr?.verified ?? false,
    });
  }
  return out;
}

export async function acceptPlanOffer(
  client: SupabaseClient,
  params: {
    planId: string;
    offer: DbPlanOffer;
    plan: DbPlan;
    currentUserId: string;
  }
): Promise<{ error: string | null }> {
  const { offer, plan, currentUserId } = params;
  if (plan.creator_id !== currentUserId) {
    return { error: 'Only the plan host can accept an offer.' };
  }
  const liveStatuses = ['pending', 'countered', 'countered_by_host', 'countered_by_guest'];
  if (!liveStatuses.includes(offer.status)) {
    return { error: 'This offer can no longer be accepted.' };
  }

  const { error } = await client.rpc('host_respond_to_offer', {
    p_offer_id: offer.id,
    p_action: 'accept',
  });
  if (error) {
    if (error.message.includes('escrow_transactions_plan_guest_unique')) {
      return {
        error:
          'This guest already has an escrow slot on this plan. Refresh and try again, or contact support if the issue persists.',
      };
    }
    if (error.message.includes('guest_escrow_already_funded')) {
      return {
        error: 'This guest has already funded their share on this plan.',
      };
    }
    return { error: error.message };
  }
  return { error: null };
}
