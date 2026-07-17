import { openEscrowCheckout } from '@/lib/escrow/openEscrowCheckout';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Close the group and create the host escrow row — payment happens on the escrow screen. */
export async function closeGroupAndCreateHostEscrow(
  client: SupabaseClient,
  planId: string
): Promise<{ ok: boolean; error?: string; hostEscrowId?: string }> {
  const { data: hostEscrowId, error } = await client.rpc('close_group_and_create_host_escrow', {
    p_plan_id: planId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const escrowId = typeof hostEscrowId === 'string' ? hostEscrowId : null;
  if (!escrowId) {
    return { ok: false, error: 'Could not close group.' };
  }

  return { ok: true, hostEscrowId: escrowId };
}

export async function closeGroupAndPayHostShare(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<{ ok: boolean; error?: string; hostEscrowId?: string }> {
  const closed = await closeGroupAndCreateHostEscrow(client, planId);
  if (!closed.ok || !closed.hostEscrowId) {
    return closed;
  }

  const checkout = await openEscrowCheckout({
    escrowId: closed.hostEscrowId,
    planId,
    escrowLeg: 'host',
    initiatedByUserId: userId,
  });

  if (!checkout.ok) {
    return {
      ok: false,
      error: checkout.error ?? 'Could not start payment.',
      hostEscrowId: closed.hostEscrowId,
    };
  }

  return { ok: true, hostEscrowId: closed.hostEscrowId };
}
