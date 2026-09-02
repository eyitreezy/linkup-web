import { openOrCreateGroupChat } from '@/lib/messaging/openOrCreateGroupChat';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { isNonNegotiablePlan } from '@/lib/plans/planTypeHelpers';
import type { DbPlan, DbPlanJoinRequest, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export class PlanMeetupChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanMeetupChatError';
  }
}

function resolveCounterpartyFromOffers(
  plan: DbPlan,
  isCreator: boolean,
  offers: DbPlanOffer[]
): string | null {
  const sorted = [...offers].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const lastBidder = [...sorted].reverse().find((o) => o.bidder_id !== plan.creator_id)?.bidder_id;
  return isCreator ? lastBidder ?? null : plan.creator_id;
}

function resolveCounterpartyFromJoinRequests(
  plan: DbPlan,
  isCreator: boolean,
  joinRequests: DbPlanJoinRequest[]
): string | null {
  const approved = joinRequests
    .filter((r) => r.status === 'approved')
    .sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime()
    );

  if (isCreator) {
    return approved[0]?.requester_id ?? null;
  }

  const guestApproved = approved.find((r) => r.requester_id !== plan.creator_id);
  return guestApproved ? plan.creator_id : null;
}

function resolveStandardPlanCounterparty(
  plan: DbPlan,
  isCreator: boolean,
  offers: DbPlanOffer[],
  joinRequests?: DbPlanJoinRequest[]
): string | null {
  if (isNonNegotiablePlan(plan) && joinRequests?.length) {
    const fromJoinRequests = resolveCounterpartyFromJoinRequests(plan, isCreator, joinRequests);
    if (fromJoinRequests) return fromJoinRequests;
  }

  return resolveCounterpartyFromOffers(plan, isCreator, offers);
}

export async function openPlanMeetupChatPath(
  client: SupabaseClient,
  {
    plan,
    userId,
    isCreator,
    offers,
    joinRequests,
  }: {
    plan: DbPlan;
    userId: string;
    isCreator: boolean;
    offers: DbPlanOffer[];
    joinRequests?: DbPlanJoinRequest[];
  }
): Promise<string> {
  if (plan.is_group_plan) {
    return openGroupPlanMeetupChatPath(client, plan, userId, offers, joinRequests);
  }

  const other = resolveStandardPlanCounterparty(plan, isCreator, offers, joinRequests);
  if (!other) {
    throw new PlanMeetupChatError(
      isCreator
        ? isNonNegotiablePlan(plan)
          ? 'No approved guest yet. Check back after a join request is approved.'
          : 'No one has sent an offer yet. Check back soon.'
        : 'Could not open chat.'
    );
  }
  return openDirectChatPath(client, userId, other);
}

async function openGroupPlanMeetupChatPath(
  client: SupabaseClient,
  plan: DbPlan,
  userId: string,
  offers: DbPlanOffer[],
  joinRequests?: DbPlanJoinRequest[]
): Promise<string> {
  let resolvedJoinRequests = joinRequests;
  if (plan.is_negotiable === false && !resolvedJoinRequests) {
    const { data } = await client.from('plan_join_requests').select('*').eq('plan_id', plan.id);
    resolvedJoinRequests = (data ?? []) as DbPlanJoinRequest[];
  }

  const convId = await openOrCreateGroupChat(client, {
    plan,
    userId,
    offers,
    joinRequests: resolvedJoinRequests,
  });
  return `/chat/group/${convId}`;
}

export async function openPlanMeetupChatPathForPlanId(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<string> {
  const { data: plan, error: planErr } = await client
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (planErr || !plan) {
    throw new PlanMeetupChatError('Plan not found');
  }

  const { data: offers } = await client
    .from('plan_offers')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });

  let joinRequests: DbPlanJoinRequest[] | undefined;
  if (plan.is_negotiable === false) {
    const { data: rows } = await client.from('plan_join_requests').select('*').eq('plan_id', planId);
    joinRequests = (rows ?? []) as DbPlanJoinRequest[];
  }

  return openPlanMeetupChatPath(client, {
    plan: plan as DbPlan,
    userId,
    isCreator: plan.creator_id === userId,
    offers: (offers ?? []) as DbPlanOffer[],
    joinRequests,
  });
}
