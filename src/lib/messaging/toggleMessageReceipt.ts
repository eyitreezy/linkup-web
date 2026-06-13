import type { SupabaseClient } from '@supabase/supabase-js';

export async function toggleMessageReceipt(
  client: SupabaseClient,
  messageId: string,
  hidden: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from('messages')
    .update({ receipt_hidden: hidden })
    .eq('id', messageId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
