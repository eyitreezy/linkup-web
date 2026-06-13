import {
  canEditMessage,
  MESSAGE_EDIT_WINDOW_MS,
  withinMsSince,
} from '@/lib/messaging/messageEditRules';
import type { ChatMessageRow } from '@/services/messages.service';
import { normalizeMessageRow, messageSelectColumns } from '@/services/messages.service';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EditMessageResult =
  | { ok: true; row: ChatMessageRow }
  | { ok: false; error: string; code?: 'window_expired' | 'empty' | 'unchanged' };

export async function editMessage(
  client: SupabaseClient,
  message: Pick<ChatMessageRow, 'id' | 'sender_id' | 'created_at' | 'text' | 'body' | 'deleted_at'>,
  viewerId: string,
  nextText: string
): Promise<EditMessageResult> {
  const body = nextText.trim();
  if (!body) return { ok: false, error: 'Message cannot be empty', code: 'empty' };

  if (!canEditMessage(message, viewerId)) {
    const expired = !withinMsSince(message.created_at, MESSAGE_EDIT_WINDOW_MS);
    return {
      ok: false,
      error: expired ? 'This message can no longer be edited' : 'This message cannot be edited',
      code: expired ? 'window_expired' : undefined,
    };
  }

  const current = (message.text ?? message.body ?? '').trim();
  if (current === body) {
    return { ok: false, error: 'No changes to save', code: 'unchanged' };
  }

  const { data, error } = await client
    .from('messages')
    .update({
      text: body,
      edited_at: new Date().toISOString(),
      moderation_status: 'clean',
    })
    .eq('id', message.id)
    .eq('sender_id', viewerId)
    .is('deleted_at', null)
    .select(messageSelectColumns())
    .single();

  if (error) {
    const msg = error.message ?? 'Could not update message';
    if (msg.includes('message_edit_window_expired')) {
      return { ok: false, error: 'This message can no longer be edited', code: 'window_expired' };
    }
    return { ok: false, error: msg };
  }

  if (!data) return { ok: false, error: 'Could not update message' };

  return {
    ok: true,
    row: normalizeMessageRow(data as unknown as Record<string, unknown>),
  };
}
