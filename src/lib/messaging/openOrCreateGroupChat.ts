import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlan, DbPlanJoinRequest, DbPlanOffer } from '@/types/database';
import { createGroupChat } from '@/lib/messaging/createGroupChat';
import { findGroupChatIdForPlan } from '@/lib/messaging/groupChatLookup';

export class GroupChatError extends Error {
  readonly userTitle: string;
  readonly userMessage: string;

  constructor(userTitle: string, userMessage: string) {
    super(userMessage);
    this.name = 'GroupChatError';
    this.userTitle = userTitle;
    this.userMessage = userMessage;
  }
}

/** Accepted participants for a group chat, independent of negotiation mode. */
export function resolveGroupChatParticipantIds(
  plan: Pick<DbPlan, 'creator_id' | 'is_negotiable'>,
  opts: {
    offers?: DbPlanOffer[];
    joinRequests?: DbPlanJoinRequest[];
  }
): string[] {
  const hostId = plan.creator_id;
  if (plan.is_negotiable === false) {
    return (opts.joinRequests ?? [])
      .filter((r) => r.status === 'approved')
      .map((r) => r.requester_id)
      .filter((id): id is string => !!id && id !== hostId);
  }
  return (opts.offers ?? [])
    .filter((o) => o.status === 'accepted')
    .map((o) => o.bidder_id)
    .filter((id): id is string => !!id && id !== hostId);
}

async function lookupGroupChatId(client: SupabaseClient, planId: string): Promise<string | null> {
  const id = await findGroupChatIdForPlan(client, planId);
  return id;
}

export async function openOrCreateGroupChat(
  client: SupabaseClient,
  params: {
    plan: Pick<DbPlan, 'id' | 'creator_id' | 'title' | 'is_group_plan' | 'is_negotiable'>;
    userId: string;
    offers?: DbPlanOffer[];
    joinRequests?: DbPlanJoinRequest[];
  }
): Promise<string> {
  const { plan, userId, offers, joinRequests } = params;

  if (!plan.is_group_plan) {
    throw new GroupChatError(
      'Unable to open group chat',
      'This meetup does not have a group chat.'
    );
  }

  const existing = await lookupGroupChatId(client, plan.id);
  if (existing) return existing;

  if (plan.creator_id !== userId) {
    throw new GroupChatError(
      'Group chat not ready',
      'The host has not opened the group chat yet. Check back once they start it.'
    );
  }

  const memberIds = resolveGroupChatParticipantIds(plan, { offers, joinRequests });

  try {
    return await createGroupChat(client, {
      planId: plan.id,
      hostId: userId,
      groupName: plan.title,
      initialMemberIds: memberIds,
    });
  } catch {
    throw new GroupChatError(
      'Unable to open group chat',
      'We could not open this plan\'s group chat right now. Please try again.'
    );
  }
}

export function groupChatErrorDialog(error: unknown): {
  title: string;
  message: string;
  variant: 'error';
  buttonLabel?: string;
  retry?: boolean;
} {
  if (error instanceof GroupChatError) {
    return {
      title: error.userTitle,
      message: error.userMessage,
      variant: 'error',
      buttonLabel: error.userTitle === 'Unable to open group chat' ? 'Try again' : 'Got it',
      retry: error.userTitle === 'Unable to open group chat',
    };
  }
  return {
    title: 'Unable to open group chat',
    message: 'We could not open this plan\'s group chat right now. Please try again.',
    variant: 'error',
    buttonLabel: 'Try again',
    retry: true,
  };
}
