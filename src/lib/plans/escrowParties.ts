import type { DbPlan, EscrowPattern } from '@/types/database';

export type EscrowRoleSplit = {
  payerId: string;
  payeeId: string;
  hostShareCents: number;
  guestShareCents: number;
};

export function resolveEscrowParties(
  plan: Pick<DbPlan, 'creator_id' | 'escrow_pattern' | 'host_contribution_bps'>,
  guestUserId: string,
  totalCents: number
): EscrowRoleSplit {
  const hostId = plan.creator_id;
  const pattern = (plan.escrow_pattern ?? 'A') as EscrowPattern;
  const bps = plan.host_contribution_bps ?? 5000;

  let hostShare = 0;
  let guestShare = 0;
  let payerId: string;
  let payeeId: string;

  switch (pattern) {
    case 'A':
      hostShare = totalCents;
      guestShare = 0;
      payerId = hostId;
      payeeId = guestUserId;
      break;
    case 'C':
      hostShare = 0;
      guestShare = totalCents;
      payerId = guestUserId;
      payeeId = hostId;
      break;
    case 'B':
      hostShare = Math.floor((totalCents * bps) / 10_000);
      guestShare = totalCents - hostShare;
      payerId = hostId;
      payeeId = guestUserId;
      break;
    default:
      hostShare = totalCents;
      guestShare = 0;
      payerId = hostId;
      payeeId = guestUserId;
  }

  return { payerId, payeeId, hostShareCents: hostShare, guestShareCents: guestShare };
}
