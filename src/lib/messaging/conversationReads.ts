import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ConversationReadRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  last_read_message_id: string | null;
  updated_at: string;
};

export async function fetchPeerReadCursor(
  client: SupabaseClient,
  conversationId: string,
  peerUserId: string
): Promise<ConversationReadRow | null> {
  const { data, error } = await client
    .from('conversation_reads')
    .select('conversation_id, user_id, last_read_at, last_read_message_id, updated_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', peerUserId)
    .maybeSingle();
  if (error) return null;
  return (data as ConversationReadRow | null) ?? null;
}

export async function markConversationRead(
  client: SupabaseClient,
  conversationId: string,
  messageId?: string | null
): Promise<ConversationReadRow | null> {
  const { data, error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
    p_message_id: messageId ?? null,
  });
  if (error) return null;
  return (data as ConversationReadRow | null) ?? null;
}

/** True when peer's read cursor is at or past this outgoing message. */
export function isOutgoingMessageRead(
  messageCreatedAt: string,
  peerRead: ConversationReadRow | null | undefined
): boolean {
  if (!peerRead?.last_read_at) return false;
  return new Date(peerRead.last_read_at).getTime() >= new Date(messageCreatedAt).getTime();
}

/** Browser client helper for mark read from inbox cache. */
export function markConversationReadDefault(
  conversationId: string,
  messageId?: string | null
): void {
  void markConversationRead(createClient(), conversationId, messageId);
}
