import type { SupabaseClient } from '@supabase/supabase-js';
import {
  escrowUserPaymentVerified,
  type EscrowFundingRow,
} from '@/lib/escrow/escrowFundingStatus';

export type EscrowFundingStatusSnapshot = {
  found: boolean;
  userLegFunded: boolean;
  escrowFundingComplete: boolean;
  status: string | null;
  hostFundedAt: string | null;
  guestFundedAt: string | null;
  checkoutInitiatedBy: string | null;
};

const ESCROW_FUNDING_SELECT =
  'status, escrow_pattern, host_id, guest_id, payer_id, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents, metadata';

function parseRpcSnapshot(raw: unknown): EscrowFundingStatusSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.found !== true) return null;
  return {
    found: true,
    userLegFunded: row.user_leg_funded === true,
    escrowFundingComplete: row.escrow_funding_complete === true,
    status: typeof row.status === 'string' ? row.status : null,
    hostFundedAt: typeof row.host_funded_at === 'string' ? row.host_funded_at : null,
    guestFundedAt: typeof row.guest_funded_at === 'string' ? row.guest_funded_at : null,
    checkoutInitiatedBy:
      typeof row.checkout_initiated_by === 'string' ? row.checkout_initiated_by : null,
  };
}

/** Authoritative funding read via SECURITY DEFINER RPC when available. */
export async function fetchEscrowFundingVerified(
  client: SupabaseClient,
  escrowId: string,
  viewerUserId?: string | null
): Promise<boolean> {
  const { data: rpcData, error: rpcError } = await client.rpc('get_escrow_user_funding_status', {
    p_escrow_id: escrowId,
  });

  if (!rpcError) {
    const snapshot = parseRpcSnapshot(rpcData);
    if (snapshot?.userLegFunded || snapshot?.escrowFundingComplete) {
      return true;
    }
  }

  const { data } = await client
    .from('escrow_transactions')
    .select(ESCROW_FUNDING_SELECT)
    .eq('id', escrowId)
    .maybeSingle();

  const escrow = (data as EscrowFundingRow | null) ?? null;
  return escrowUserPaymentVerified(escrow, viewerUserId ?? null);
}

export async function fetchEscrowFundingRow(
  client: SupabaseClient,
  escrowId: string
): Promise<EscrowFundingRow | null> {
  const { data } = await client
    .from('escrow_transactions')
    .select(ESCROW_FUNDING_SELECT)
    .eq('id', escrowId)
    .maybeSingle();
  return (data as EscrowFundingRow | null) ?? null;
}
