import type { SupabaseClient } from '@supabase/supabase-js';

/** Sync pending host_close escrow row with current guest commitments (idempotent). */
export async function refreshGroupHostCloseEscrowShare(
  client: SupabaseClient,
  planId: string
): Promise<boolean> {
  const { data, error } = await client.rpc('refresh_group_host_close_escrow_share', {
    p_plan_id: planId,
  });
  if (error) {
    console.warn('[refreshGroupHostCloseEscrowShare]', planId, error.message);
    return false;
  }
  return data === true;
}
