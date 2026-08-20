import type { SupabaseClient } from '@supabase/supabase-js';
import { findGroupChatIdForPlan } from '@/lib/messaging/groupChatLookup';

export type CreateGroupChatParams = {
  planId: string;
  hostId: string;
  groupName?: string;
  initialMemberIds: string[];
};

export async function createGroupChat(
  client: SupabaseClient,
  { planId, hostId, groupName, initialMemberIds }: CreateGroupChatParams
): Promise<string> {
  const { data: plan, error: planErr } = await client
    .from('plans')
    .select('is_group_plan, creator_id, title')
    .eq('id', planId)
    .single();

  if (planErr || !plan?.is_group_plan || plan.creator_id !== hostId) {
    throw new Error('Only group plan hosts can create group chats');
  }

  const existing = await findGroupChatIdForPlan(client, planId);
  if (existing) return existing;

  const conversationId = crypto.randomUUID();
  const { error: convErr } = await client.from('conversations').insert({
    id: conversationId,
    is_group_chat: true,
    plan_id: planId,
    group_name: groupName ?? plan.title,
    created_by: hostId,
  });

  if (convErr) {
    if (convErr.code === '23505') {
      const raced = await findGroupChatIdForPlan(client, planId);
      if (raced) return raced;
    }
    throw new Error(convErr.message);
  }

  const { error: hostErr } = await client.from('group_chat_members').insert({
    conversation_id: conversationId,
    user_id: hostId,
    is_admin: true,
  });
  if (hostErr) throw new Error(hostErr.message);

  const guestIds = [...new Set(initialMemberIds.filter((id) => id !== hostId))];
  if (guestIds.length > 0) {
    const { error: guestsErr } = await client.from('group_chat_members').insert(
      guestIds.map((uid) => ({
        conversation_id: conversationId,
        user_id: uid,
        is_admin: false,
      }))
    );
    if (guestsErr) throw new Error(guestsErr.message);
  }

  return conversationId;
}
