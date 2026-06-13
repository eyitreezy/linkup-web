import { messageSelectColumns, normalizeMessageRow } from '@/services/messages.service';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function sendSystemMessage(
  client: SupabaseClient,
  conversationId: string,
  body: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: null,
      text: body,
      moderation_status: 'clean',
    })
    .select(messageSelectColumns())
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not send system message' };
  const row = normalizeMessageRow(data as unknown as Record<string, unknown>);
  return { ok: true, id: row.id };
}
