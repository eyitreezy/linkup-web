import { activeGroupEscrowRows, type GroupEscrowFundingRow } from '@/lib/plans/groupFundedMemberCount';
import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { escrowRequiredLegsSatisfied } from '@/lib/escrow/escrowFundingStatus';
import type { DbPlan } from '@/types/database';

/** Total roster size = 1 host + max_guests guest slots. */
export type GroupPlanCapacity = {
  maxGuestSlots: number;
  maxTotalMembers: number;
};

export function resolveGroupPlanCapacity(
  plan: Pick<DbPlan, 'max_guests'>
): GroupPlanCapacity {
  const maxGuestSlots = Math.max(0, plan.max_guests ?? 0);
  return {
    maxGuestSlots,
    maxTotalMembers: maxGuestSlots + 1,
  };
}

function guestEscrowFunded(
  escrow: GroupEscrowFundingRow,
  guestId: string
): boolean {
  return (
    userEscrowLegFunded(escrow, guestId) || escrowRequiredLegsSatisfied(escrow)
  );
}

/** Latest active escrow leg per guest (ignores cancelled/refunded historical rows). */
export function latestActiveGuestEscrowByUserId(
  escrows: GroupEscrowFundingRow[]
): Map<string, GroupEscrowFundingRow> {
  const byGuest = new Map<string, GroupEscrowFundingRow>();
  for (const row of activeGroupEscrowRows(escrows)) {
    if (!row.guest_id) continue;
    const existing = byGuest.get(row.guest_id);
    if (!existing) {
      byGuest.set(row.guest_id, row);
      continue;
    }
    // Prefer funded leg over pending when duplicates exist.
    const existingFunded = guestEscrowFunded(existing, row.guest_id);
    const rowFunded = guestEscrowFunded(row, row.guest_id);
    if (rowFunded && !existingFunded) {
      byGuest.set(row.guest_id, row);
    }
  }
  return byGuest;
}

/** Guest payment progress for agreement/escrow UI (roster-based, not raw escrow row count). */
export function resolveGroupGuestPaymentProgress(
  plan: Pick<DbPlan, 'max_guests'>,
  escrows: GroupEscrowFundingRow[],
  acceptedGuestUserIds: string[]
): {
  capacity: GroupPlanCapacity;
  fundedGuestCount: number;
  acceptedGuestCount: number;
  pendingGuestCount: number;
} {
  const capacity = resolveGroupPlanCapacity(plan);
  const escrowByGuest = latestActiveGuestEscrowByUserId(escrows);
  const rosterIds = [...new Set(acceptedGuestUserIds.filter(Boolean))];
  const acceptedGuestCount = rosterIds.length;

  let fundedGuestCount = 0;
  for (const guestId of rosterIds) {
    const leg = escrowByGuest.get(guestId);
    if (leg && guestEscrowFunded(leg, guestId)) {
      fundedGuestCount += 1;
    }
  }

  const pendingGuestCount = Math.max(0, acceptedGuestCount - fundedGuestCount);

  return {
    capacity,
    fundedGuestCount,
    acceptedGuestCount,
    pendingGuestCount,
  };
}
