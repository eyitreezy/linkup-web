import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import type { DbEscrowTransaction } from '@/types/database';

export type EscrowFundingRow = Pick<
  DbEscrowTransaction,
  | 'status'
  | 'escrow_pattern'
  | 'host_id'
  | 'guest_id'
  | 'payer_id'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'metadata'
>;

export function escrowStatusFullyFunded(status: string | null | undefined): boolean {
  return status === 'funded' || status === 'active' || status === 'released';
}

/** Pattern B escrows with a zero share only require the paying leg. */
/** Group guest-slot or host-close rows fund a single leg per escrow row. */
export function isSingleLegEscrowRow(
  escrow:
    | Pick<
        EscrowFundingRow,
        'escrow_pattern' | 'host_share_cents' | 'guest_share_cents'
      >
    | null
    | undefined
): boolean {
  if (!escrow || escrow.escrow_pattern !== 'B') return false;
  const hostShare = Math.max(0, escrow.host_share_cents ?? 0);
  const guestShare = Math.max(0, escrow.guest_share_cents ?? 0);
  return hostShare <= 0 || guestShare <= 0;
}

export function escrowRequiredLegsSatisfied(
  escrow:
    | Pick<
        EscrowFundingRow,
        | 'status'
        | 'escrow_pattern'
        | 'host_funded_at'
        | 'guest_funded_at'
        | 'host_share_cents'
        | 'guest_share_cents'
      >
    | null
    | undefined
): boolean {
  if (!escrow) return false;
  if (escrowStatusFullyFunded(escrow.status)) return true;

  if (escrow.escrow_pattern !== 'B') {
    return escrow.status !== 'pending_funding';
  }

  const hostShare = Math.max(0, escrow.host_share_cents ?? 0);
  const guestShare = Math.max(0, escrow.guest_share_cents ?? 0);

  if (hostShare <= 0) {
    return !!escrow.guest_funded_at;
  }
  if (guestShare <= 0) {
    return !!escrow.host_funded_at;
  }
  return !!escrow.host_funded_at && !!escrow.guest_funded_at;
}

export function escrowUserPaymentVerified(
  escrow: EscrowFundingRow | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!escrow) return false;

  // Group guest-slot / host-close rows: one funded leg completes this escrow row.
  if (isSingleLegEscrowRow(escrow) && escrowRequiredLegsSatisfied(escrow)) {
    return true;
  }

  if (!userId) return false;
  if (userEscrowLegFunded(escrow, userId)) return true;
  if (escrowRequiredLegsSatisfied(escrow)) return true;
  return false;
}

export function escrowCheckoutInitiator(
  escrow: EscrowFundingRow | null | undefined
): string | null {
  if (!escrow?.metadata || typeof escrow.metadata !== 'object' || Array.isArray(escrow.metadata)) {
    return null;
  }
  const by = (escrow.metadata as Record<string, unknown>).checkout_initiated_by;
  return typeof by === 'string' && by.trim() ? by.trim() : null;
}
