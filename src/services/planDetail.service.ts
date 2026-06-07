import { isPlanSaved, recordPlanView } from '@/lib/plans/planEngagement';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbPlanOffer, DbProfile } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileMini = Pick<
  DbProfile,
  | 'user_id'
  | 'display_name'
  | 'avatar_url'
  | 'primary_photo_url'
  | 'photo_urls'
  | 'verified_badge'
  | 'location_label'
  | 'preferences'
>;

export type PlanDetailBundle = {
  plan: PlanFeedRow;
  offers: DbPlanOffer[];
  profilesById: Record<string, ProfileMini>;
  saved: boolean;
  completionSelfAcked: boolean;
};

export async function fetchPlanDetailBundle(
  client: SupabaseClient,
  planId: string,
  viewerId: string | null
): Promise<{ data: PlanDetailBundle | null; error: string | null }> {
  const { data: plan, error: planError } = await client
    .from('plans')
    .select('*, meet_types(*)')
    .eq('id', planId)
    .maybeSingle();

  if (planError) return { data: null, error: planError.message };
  if (!plan) return { data: null, error: null };

  const row = plan as PlanFeedRow;

  const { data: offersRaw } = await client
    .from('plan_offers')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(20);
  const offers = (offersRaw ?? []) as DbPlanOffer[];

  const idSet = new Set<string>([row.creator_id]);
  const accepted = offers.find((x) => x.id === row.accepted_offer_id);
  if (accepted) idSet.add(accepted.bidder_id);
  for (const off of offers) idSet.add(off.bidder_id);

  const { data: profs } = await client
    .from('profiles')
    .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls, verified_badge, location_label, preferences')
    .in('user_id', [...idSet]);

  const profilesById: Record<string, ProfileMini> = {};
  for (const p of profs ?? []) {
    profilesById[p.user_id as string] = p as ProfileMini;
  }

  const { data: creatorFull } = await client
    .from('profiles')
    .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls, verified_badge, ai_trust_score, preferences')
    .eq('user_id', row.creator_id)
    .maybeSingle();

  const feedRow: PlanFeedRow = {
    ...row,
    creator: creatorFull
      ? {
          display_name: creatorFull.display_name,
          avatar_url: creatorFull.avatar_url,
          primary_photo_url: creatorFull.primary_photo_url,
          photo_urls: creatorFull.photo_urls,
          verified_badge: creatorFull.verified_badge,
          ai_trust_score: creatorFull.ai_trust_score,
          preferences: creatorFull.preferences,
        }
      : null,
  };

  let saved = false;
  let completionSelfAcked = false;

  if (viewerId) {
    saved = await isPlanSaved(client, planId, viewerId);
    if (feedRow.creator_id !== viewerId && feedRow.status !== 'draft') {
      void recordPlanView(client, planId, viewerId);
    }
    if (feedRow.status === 'completed') {
      const { data: ack } = await client
        .from('plan_completion_acks')
        .select('user_id')
        .eq('plan_id', planId)
        .eq('user_id', viewerId)
        .maybeSingle();
      completionSelfAcked = !!ack;
    }
  }

  return {
    data: {
      plan: feedRow,
      offers,
      profilesById,
      saved,
      completionSelfAcked,
    },
    error: null,
  };
}
