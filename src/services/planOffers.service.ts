import {
  countOffersTowardLimit,
  MAX_OFFERS_PER_PLAN,
  nextOfferRound,
  OFFER_TTL_MS,
} from '@/lib/plans/offerRules';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchOffersForPlan(
  client: SupabaseClient,
  planId: string,
  ascending = true
): Promise<DbPlanOffer[]> {
  const { data, error } = await client
    .from('plan_offers')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbPlanOffer[];
}

export async function submitPlanOffer(
  client: SupabaseClient,
  params: {
    plan: DbPlan;
    bidderId: string;
    amountCents: number | null;
    message: string | null;
    proposedScheduledAt: string | null;
    existingOffers: DbPlanOffer[];
  }
): Promise<{ error: string | null }> {
  const { plan, bidderId, amountCents, message, proposedScheduledAt, existingOffers } = params;

  if (plan.status !== 'negotiating') {
    return { error: 'This plan is not open for new offers.' };
  }
  if (countOffersTowardLimit(existingOffers) >= MAX_OFFERS_PER_PLAN) {
    return { error: `Offer limit reached (${MAX_OFFERS_PER_PLAN} active rounds).` };
  }

  const expires = new Date(Date.now() + OFFER_TTL_MS).toISOString();
  const { error } = await client.from('plan_offers').insert({
    plan_id: plan.id,
    bidder_id: bidderId,
    amount_cents: amountCents,
    message: message?.trim() || null,
    proposed_scheduled_at: proposedScheduledAt,
    status: 'pending',
    round: nextOfferRound(existingOffers),
    expires_at: expires,
  });

  return { error: error?.message ?? null };
}

export async function declinePlanOffer(
  client: SupabaseClient,
  offerId: string
): Promise<{ error: string | null }> {
  const { error } = await client.from('plan_offers').update({ status: 'declined' }).eq('id', offerId);
  return { error: error?.message ?? null };
}
