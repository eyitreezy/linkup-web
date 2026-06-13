import { fetchActiveGroupMembers, type GroupChatMemberRow } from '@/lib/messaging/groupChatMembers';
import type { SupabaseClient } from '@supabase/supabase-js';

export function subscribeGroupMembersRealtime(
  client: SupabaseClient,
  conversationId: string,
  onMemberChange: (members: GroupChatMemberRow[]) => void
): () => void {
  if (!conversationId) return () => {};

  const channel = client.channel(`group-members:${conversationId}:${Date.now()}`);

  const refetch = () => {
    void fetchActiveGroupMembers(client, conversationId).then(onMemberChange);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'group_chat_members',
        filter: `conversation_id=eq.${conversationId}`,
      },
      refetch
    )
    .subscribe();

  void fetchActiveGroupMembers(client, conversationId).then(onMemberChange);

  return () => {
    void client.removeChannel(channel);
  };
}
