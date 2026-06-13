import {
  normalizeMessageRow,
  messageSelectColumns,
  type ChatMessageRow,
} from '@/services/messages.service';
import type { SupabaseClient } from '@supabase/supabase-js';

let receiptColumnSupported: boolean | null = null;

function selectColumns(): string {
  const base = messageSelectColumns();
  if (receiptColumnSupported === false) return base;
  return `${base}, receipt_hidden`;
}

function downgradeReceiptColumn(cols: string): string {
  receiptColumnSupported = false;
  return cols.replace(', receipt_hidden', '');
}

export async function searchMessagesInConversation(
  client: SupabaseClient,
  conversationId: string,
  query: string,
  viewerId: string
): Promise<ChatMessageRow[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  let cols = selectColumns();
  let result = await client
    .from('messages')
    .select(cols)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .ilike('text', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (result.error?.code === '42703' && cols.includes('receipt_hidden')) {
    cols = downgradeReceiptColumn(cols);
    result = await client
      .from('messages')
      .select(cols)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .ilike('text', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);
  }

  if (result.error || !result.data?.length) return [];

  const rows = result.data.map((row) =>
    normalizeMessageRow(row as unknown as Record<string, unknown>)
  );
  const ids = rows.map((r) => r.id);
  const { data: deletions } = await client
    .from('message_user_deletions')
    .select('message_id')
    .eq('user_id', viewerId)
    .in('message_id', ids);

  const hidden = new Set((deletions ?? []).map((d) => d.message_id as string));
  return rows.filter((r) => !hidden.has(r.id));
}
