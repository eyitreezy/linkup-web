import type { DbEscrowTransaction, EscrowPattern } from '@/types/database';

type SplitFields = Pick<
  DbEscrowTransaction,
  'escrow_pattern' | 'status' | 'host_funded_at' | 'guest_funded_at'
>;

export function isSplitEscrowPattern(pattern: EscrowPattern | string | null | undefined): boolean {
  return pattern === 'B';
}

/** Both parties paid their share (pattern B) or single-payer escrow is funded. */
export function isEscrowFullyFundedForMeet(escrow: SplitFields): boolean {
  if (isSplitEscrowPattern(escrow.escrow_pattern)) {
    return !!escrow.host_funded_at && !!escrow.guest_funded_at;
  }
  return (
    escrow.status === 'funded' ||
    escrow.status === 'active' ||
    escrow.status === 'released'
  );
}

/** Whether this user has completed their escrow payment leg. */
export function userEscrowLegFunded(
  escrow: Pick<
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
  >,
  userId: string
): boolean {
  if (isSplitEscrowPattern(escrow.escrow_pattern)) {
    const hostShare = Math.max(0, escrow.host_share_cents ?? 0);
    const guestShare = Math.max(0, escrow.guest_share_cents ?? 0);
    const paysHostLeg =
      userId === escrow.host_id ||
      (escrow.guest_id == null && userId === escrow.payer_id);
    const paysGuestLeg =
      userId === escrow.guest_id ||
      (escrow.guest_id != null && userId === escrow.payer_id);

    if (paysHostLeg && (escrow.guest_id == null || hostShare > 0)) {
      return !!escrow.host_funded_at;
    }
    if (paysGuestLeg && guestShare > 0) {
      return !!escrow.guest_funded_at;
    }
    return false;
  }
  if (escrow.status === 'funded' || escrow.status === 'active' || escrow.status === 'released') {
    return true;
  }
  if (userId === escrow.payer_id) {
    return escrow.status !== 'pending_funding';
  }
  return escrow.status !== 'pending_funding';
}

export function isSplitEscrowPartiallyFunded(escrow: SplitFields): boolean {
  if (!isSplitEscrowPattern(escrow.escrow_pattern)) return false;
  const hostDone = !!escrow.host_funded_at;
  const guestDone = !!escrow.guest_funded_at;
  return (hostDone || guestDone) && !(hostDone && guestDone);
}

export function escrowPaymentConfirmedMessage(
  escrow: SplitFields & { host_id?: string | null; guest_id?: string | null },
  userId?: string
): { title: string; message: string } {
  if (isSplitEscrowPattern(escrow.escrow_pattern)) {
    if (isEscrowFullyFundedForMeet(escrow)) {
      return {
        title: 'Escrow fully funded',
        message: 'Both shares received. Your plan is now active.',
      };
    }
    const userPaidLeg =
      userId != null &&
      ((userId === escrow.host_id && !!escrow.host_funded_at) ||
        (userId === escrow.guest_id && !!escrow.guest_funded_at));
    if (userPaidLeg || isSplitEscrowPartiallyFunded(escrow)) {
      return {
        title: 'Your share funded',
        message:
          "Your payment is confirmed. Waiting for the other person's share before the plan goes active.",
      };
    }
  }
  return {
    title: 'Escrow funded',
    message: 'Payment confirmed. Your plan is now active.',
  };
}
