import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import type { DbEscrowTransaction } from '@/types/database';

export type GuestEscrowRowFields = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'host_id'
  | 'guest_id'
  | 'payer_id'
  | 'status'
  | 'escrow_pattern'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'metadata'
>;

export function findGuestEscrowForBidder(
  escrows: GuestEscrowRowFields[],
  bidderId: string
): GuestEscrowRowFields | undefined {
  return (
    escrows.find((e) => e.guest_id === bidderId) ??
    escrows.find((e) => e.payer_id === bidderId && e.guest_id != null)
  );
}

/** Match guest-slot escrow for join-request guests (synthetic offer id = join request id). */
export function findGuestEscrowForJoinRequestOffer(
  escrows: GuestEscrowRowFields[],
  bidderId: string,
  joinRequestId: string
): GuestEscrowRowFields | undefined {
  const byBidder = findGuestEscrowForBidder(escrows, bidderId);
  if (byBidder) return byBidder;
  return escrows.find((e) => {
    const meta = e.metadata as { request_id?: string } | null | undefined;
    return meta?.request_id === joinRequestId;
  });
}

export function isGuestEscrowFunded(
  escrow: GuestEscrowRowFields | null | undefined,
  bidderId: string
): boolean {
  if (!escrow) return false;
  return (
    userEscrowLegFunded(escrow, bidderId) ||
    escrow.status === 'funded' ||
    escrow.status === 'active' ||
    escrow.status === 'released'
  );
}

export function guestEscrowStatusLabel(
  escrow: GuestEscrowRowFields | null | undefined,
  bidderId: string,
  planPaid: boolean
): string {
  if (!escrow) {
    return planPaid ? 'Awaiting escrow' : 'Confirmed';
  }
  if (isGuestEscrowFunded(escrow, bidderId)) {
    return 'Funded';
  }
  if (escrow.status === 'pending_funding' || planPaid) {
    return 'Awaiting escrow';
  }
  return 'Confirmed';
}
