import { isPlanSaved, recordPlanView } from '@/lib/plans/planEngagement';
import type { JoinRequestWithRequester } from '@/lib/plans/joinRequests';
import { fetchActiveGroupAcceptedOffers } from '@/lib/plans/groupAcceptedGuests';
import { ensureGroupHostShareReconciled } from '@/lib/plans/ensureGroupHostShareReconciled';
import { fetchGroupHostContribution } from '@/lib/plans/fetchGroupHostContribution';
import { refreshGroupHostCloseEscrowShare } from '@/lib/plans/refreshGroupHostCloseEscrow';
import { reconcileGroupPlanGuestCommitments } from '@/lib/plans/reconcileGroupGuestCommitments';
import type { GroupHostShareResolution } from '@/lib/plans/groupDynamicSplit';
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
  hostGroupContribution: GroupHostShareResolution | null;
  activeAcceptedRoster: DbPlanOffer[];
  myInvitation: { id: string; status: string } | null;
  approvedJoinRequestCount: number;
  availableSlots: number;
  pendingInvitationCount: number;
};

const PLAN_DETAIL_SELECT = '*, meet_types(*)';

function isUsablePlanRow(row: unknown): row is PlanFeedRow {
  return !!row && typeof row === 'object' && typeof (row as PlanFeedRow).id === 'string';
}

/** Creator/history access when id-only select is blocked by restrictive RLS. */
async function loadPlanRowForDetail(
  client: SupabaseClient,
  planId: string,
  viewerId: string | null
): Promise<{ plan: PlanFeedRow | null; error: string | null }> {
  const { data: planRow, error: selectError } = await client
    .from('plans')
    .select(PLAN_DETAIL_SELECT)
    .eq('id', planId)
    .maybeSingle();

  if (isUsablePlanRow(planRow)) {
    return { plan: planRow, error: null };
  }

  if (viewerId) {
    const { data: creatorRow } = await client
      .from('plans')
      .select(PLAN_DETAIL_SELECT)
      .eq('id', planId)
      .eq('creator_id', viewerId)
      .maybeSingle();

    if (isUsablePlanRow(creatorRow)) {
      return { plan: creatorRow, error: null };
    }

    const { data: rpcRows, error: creatorError } = await client.rpc('get_creator_plan_for_detail', {
      p_plan_id: planId,
    });
    if (creatorError) {
      return { plan: null, error: creatorError.message };
    }

    const rpcPlan = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as PlanFeedRow | undefined;
    if (isUsablePlanRow(rpcPlan)) {
      if (rpcPlan.meet_types || !rpcPlan.meet_type_id) {
        return { plan: rpcPlan, error: null };
      }
      const { data: meetType } = await client
        .from('meet_types')
        .select('*')
        .eq('id', rpcPlan.meet_type_id)
        .maybeSingle();
      return {
        plan: {
          ...rpcPlan,
          meet_types: (meetType as PlanFeedRow['meet_types']) ?? null,
        },
        error: null,
      };
    }
  }

  if (selectError) return { plan: null, error: selectError.message };
  return { plan: null, error: null };
}

export async function fetchPlanDetailBundle(
  client: SupabaseClient,
  planId: string,
  viewerId: string | null
): Promise<{ data: PlanDetailBundle | null; error: string | null }> {
  let plan: PlanFeedRow | null = null;

  try {
    const loaded = await loadPlanRowForDetail(client, planId, viewerId);
    if (loaded.error) return { data: null, error: loaded.error };
    plan = loaded.plan;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load plan';
    return { data: null, error: message };
  }

  if (!plan) return { data: null, error: null };

  const row = plan;

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
  let hostGroupContribution: GroupHostShareResolution | null = null;
  let activeAcceptedRoster: DbPlanOffer[] = [];
  let myInvitation: { id: string; status: string } | null = null;
  let approvedJoinRequestCount = 0;
  let availableSlots = 0;
  let pendingInvitationCount = 0;

  if (feedPlan.is_group_plan) {
    activeAcceptedRoster = await fetchActiveGroupAcceptedOffers(client, feedPlan);
  }

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

    const { data: invitationRow } = await client
      .from('plan_invitations')
      .select('id, status')
      .eq('plan_id', planId)
      .eq('invitee_user_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    myInvitation = invitationRow as { id: string; status: string } | null;

    if (feedPlan.is_group_plan) {
      const { data: slotsRaw } = await client.rpc('get_plan_available_slots', { p_plan_id: planId });
      availableSlots = typeof slotsRaw === 'number' ? slotsRaw : 0;
    }

    if (feedPlan.creator_id !== viewerId && feedPlan.is_paid) {
      myGuestEscrow = await fetchViewerGuestEscrow(client, planId, viewerId);
    }
    if (feedPlan.creator_id === viewerId && feedPlan.is_paid && feedPlan.is_group_plan) {
      const hostGroupPlanLive =
        feedPlan.status === 'active' || feedPlan.status === 'awaiting_payment';

      if (hostGroupPlanLive) {
        await ensureGroupHostShareReconciled(client, feedPlan, viewerId);
        await reconcileGroupPlanGuestCommitments(client, planId);
        await refreshGroupHostCloseEscrowShare(client, planId);

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
      }

      myHostEscrow = await fetchHostGroupEscrow(client, feedPlan, viewerId);
      hostGroupContribution = await fetchGroupHostContribution(client, planId);
    }
  }

  if (feedPlan.is_negotiable === false) {
    const { count } = await client
      .from('plan_join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', planId)
      .eq('status', 'approved');
    approvedJoinRequestCount = count ?? 0;
  }

  if (viewerId && feedPlan.creator_id === viewerId && feedPlan.is_group_plan) {
    const { count: pendingCount } = await client
      .from('plan_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', planId)
      .eq('status', 'pending');
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
      hostGroupContribution,
      activeAcceptedRoster,
      myInvitation,
      approvedJoinRequestCount,
      availableSlots,
      pendingInvitationCount,
    },
    error: null,
  };
}
