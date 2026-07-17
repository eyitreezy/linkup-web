import type { DbPlanOffer, DbPlanOfferRound } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { submitOfferOrCounter } from '@/lib/plans/negotiationActions';

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

export async function fetchOfferRounds(
  client: SupabaseClient,
  offerId: string
): Promise<DbPlanOfferRound[]> {
  const { data, error } = await client
    .from('plan_offer_rounds')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbPlanOfferRound[];
}

export async function submitPlanOffer(
  client: SupabaseClient,
  params: {
    planId: string;
    amountCents: number | null;
    message: string | null;
    proposedScheduledAt: string | null;
    offerId?: string | null;
  }
): Promise<{ offerId: string | null; error: string | null }> {
  return submitOfferOrCounter(client, {
    planId: params.planId,
    amountCents: params.amountCents,
    note: params.message,
    proposedScheduledAt: params.proposedScheduledAt,
    offerId: params.offerId ?? null,
  });
}

/** @deprecated Use host_respond_to_offer / guest_respond_to_counter RPCs instead. */
export async function declinePlanOffer(
  client: SupabaseClient,
  offerId: string
): Promise<{ error: string | null }> {
  const { error } = await client.from('plan_offers').update({ status: 'declined' }).eq('id', offerId);
  return { error: error?.message ?? null };
}
