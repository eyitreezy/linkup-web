import type { ConversationReadRow } from '@/lib/messaging/conversationReads';
import type { SupabaseClient } from '@supabase/supabase-js';

function readsChannelTopic(conversationId: string): string {
  return `conv-reads:${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

export function subscribeConversationReadsRealtime(
  client: SupabaseClient,
  conversationId: string,
  handlers: {
    onUpsert: (row: ConversationReadRow) => void;
  }
): () => void {
  if (!conversationId) return () => {};

  const channel = client.channel(readsChannelTopic(conversationId));

  const handle = (payload: { new: Record<string, unknown> }) => {
    handlers.onUpsert(payload.new as ConversationReadRow);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      handle
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      handle
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
