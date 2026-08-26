import { isPlanSaved, recordPlanView } from '@/lib/plans/planEngagement';
import type { JoinRequestWithRequester } from '@/lib/plans/joinRequests';
import { ensureGroupHostShareReconciled } from '@/lib/plans/ensureGroupHostShareReconciled';
import {
  fetchHostGroupEscrow,
  fetchViewerGuestEscrow,
  type PlanGuestEscrowSnapshot,
} from '@/lib/plans/planPayShare';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbPlanOffer, DbProfile, JoinRequestStatus } from '@/types/database';
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
  joinRequests: JoinRequestWithRequester[];
  profilesById: Record<string, ProfileMini>;
  saved: boolean;
  completionSelfAcked: boolean;
  myJoinRequest: { id: string; status: JoinRequestStatus } | null;
  myGuestEscrow: PlanGuestEscrowSnapshot | null;
  myHostEscrow: PlanGuestEscrowSnapshot | null;
  approvedJoinRequestCount: number;
  availableSlots: number;
  pendingInvitationCount: number;
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

  let joinRequests: JoinRequestWithRequester[] = [];
  if (viewerId && row.creator_id === viewerId && row.is_negotiable === false) {
    const { data: joinRows } = await client
      .from('plan_join_requests')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(20);
    const list = (joinRows ?? []) as JoinRequestWithRequester[];
    if (list.length > 0) {
      const requesterIds = [...new Set(list.map((r) => r.requester_id))];
      const { data: requesterProfs } = await client
        .from('profiles')
        .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls')
        .in('user_id', requesterIds);
      const requesterById = new Map(
        (requesterProfs ?? []).map((p) => [
          p.user_id,
          {
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            primary_photo_url: p.primary_photo_url,
            photo_urls: p.photo_urls,
          },
        ])
      );
      joinRequests = list.map((entry) => ({
        ...entry,
        requester: requesterById.get(entry.requester_id) ?? null,
      }));
    }
  }

  const idSet = new Set<string>([row.creator_id]);
  const accepted = offers.find((x) => x.id === row.accepted_offer_id);
  if (accepted) idSet.add(accepted.bidder_id);
  for (const off of offers) idSet.add(off.bidder_id);
  for (const req of joinRequests) idSet.add(req.requester_id);

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

  let feedPlan: PlanFeedRow = feedRow;
  let saved = false;
  let completionSelfAcked = false;
  let myJoinRequest: { id: string; status: JoinRequestStatus } | null = null;
  let myGuestEscrow: PlanGuestEscrowSnapshot | null = null;
  let myHostEscrow: PlanGuestEscrowSnapshot | null = null;
  let approvedJoinRequestCount = 0;
  let availableSlots = 0;
  let pendingInvitationCount = 0;

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

    const { data: joinReq } = await client
      .from('plan_join_requests')
      .select('id, status')
      .eq('plan_id', planId)
      .eq('requester_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    myJoinRequest = joinReq as { id: string; status: JoinRequestStatus } | null;

    if (feedPlan.creator_id !== viewerId && feedPlan.is_paid) {
      myGuestEscrow = await fetchViewerGuestEscrow(client, planId, viewerId);
    }
    if (feedPlan.creator_id === viewerId && feedPlan.is_paid && feedPlan.is_group_plan) {
      await ensureGroupHostShareReconciled(client, feedPlan, viewerId);

      const { data: refreshedPlan } = await client
        .from('plans')
        .select(
          'host_escrow_id, group_closed_at, status, accepted_guest_count, accepted_guest_amounts_sum_cents, current_suggested_share_cents'
        )
        .eq('id', planId)
        .maybeSingle();

      if (refreshedPlan) {
        feedPlan = { ...feedPlan, ...refreshedPlan };
      }

      myHostEscrow = await fetchHostGroupEscrow(client, feedPlan, viewerId);
    }
  }

  if (feedPlan.is_negotiable === false) {
    if (joinRequests.length > 0) {
      approvedJoinRequestCount = joinRequests.filter((r) => r.status === 'approved').length;
    } else if (viewerId && feedPlan.creator_id === viewerId) {
      const { count } = await client
        .from('plan_join_requests')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .eq('status', 'approved');
      approvedJoinRequestCount = count ?? 0;
    }
  }

  if (viewerId && feedPlan.creator_id === viewerId && feedPlan.is_group_plan) {
    const [{ data: slotsRaw }, { count: pendingCount }] = await Promise.all([
      client.rpc('get_plan_available_slots', { p_plan_id: planId }),
      client
        .from('plan_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .eq('status', 'pending'),
    ]);
    availableSlots = typeof slotsRaw === 'number' ? slotsRaw : 0;
    pendingInvitationCount = pendingCount ?? 0;
  }

  return {
    data: {
      plan: feedPlan,
      offers,
      joinRequests,
      profilesById,
      saved,
      completionSelfAcked,
      myJoinRequest,
      myGuestEscrow,
      myHostEscrow,
      approvedJoinRequestCount,
      availableSlots,
      pendingInvitationCount,
    },
    error: null,
  };
}
