import { createGroupChat } from '@/lib/messaging/createGroupChat';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export class PlanMeetupChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanMeetupChatError';
  }
}

export async function openPlanMeetupChatPath(
  client: SupabaseClient,
  {
    plan,
    userId,
    isCreator,
    offers,
  }: {
    plan: DbPlan;
    userId: string;
    isCreator: boolean;
    offers: DbPlanOffer[];
  }
): Promise<string> {
  if (plan.is_group_plan) {
    return openGroupPlanMeetupChatPath(client, plan, userId, offers);
  }

  const sorted = [...offers].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const lastBidder = [...sorted].reverse().find((o) => o.bidder_id !== plan.creator_id)?.bidder_id;
  const other = isCreator ? lastBidder ?? null : plan.creator_id;
  if (!other) {
    throw new PlanMeetupChatError(
      isCreator ? 'No one has sent an offer yet. Check back soon.' : 'Could not open chat.'
    );
  }
  return openDirectChatPath(client, userId, other);
}

async function openGroupPlanMeetupChatPath(
  client: SupabaseClient,
  plan: DbPlan,
  userId: string,
  offers: DbPlanOffer[]
): Promise<string> {
  const { data: existing } = await client
    .from('conversations')
    .select('id')
    .eq('plan_id', plan.id)
    .eq('is_group_chat', true)
    .maybeSingle();

  if (existing?.id) return `/chat/group/${existing.id as string}`;

  if (plan.creator_id !== userId) {
    throw new PlanMeetupChatError('The host has not opened the group chat yet.');
  }

  const bidderIds = [
    ...new Set(
      offers
        .map((o) => o.bidder_id)
        .filter((id): id is string => !!id && id !== plan.creator_id)
    ),
  ];
  const convId = await createGroupChat(client, {
    planId: plan.id,
    hostId: userId,
    groupName: plan.title,
    initialMemberIds: bidderIds,
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

  return openPlanMeetupChatPath(client, {
    plan: plan as DbPlan,
    userId,
    isCreator: plan.creator_id === userId,
    offers: (offers ?? []) as DbPlanOffer[],
  });
}
