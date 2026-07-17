import type { DbPlan } from '@/types/database';

export type GroupGuestSlotTierRow = {
  subscription_tier: string;
};

export type GroupGuestSlotCounts = {
  maxGuests: number;
  freeCap: number;
  acceptedCount: number;
  freeUsed: number;
  premiumUsed: number;
};

/** Guest slot totals for the plan detail Guests panel (host view). */
export function resolveGroupGuestSlotCounts(
  plan: Pick<DbPlan, 'max_guests' | 'max_free_guests' | 'accepted_guest_count'>,
  rows: GroupGuestSlotTierRow[],
  seedAcceptedCount = 0
): GroupGuestSlotCounts {
  const maxGuests = plan.max_guests ?? plan.max_free_guests ?? 5;
  const freeCap = plan.max_free_guests ?? 5;
  const acceptedCount = Math.max(rows.length, plan.accepted_guest_count ?? 0, seedAcceptedCount);
  const freeUsed = rows.filter((r) => r.subscription_tier === 'FREE').length;
  const premiumUsed = Math.max(0, acceptedCount - freeUsed);

  return {
    maxGuests,
    freeCap,
    acceptedCount,
    freeUsed,
    premiumUsed,
  };
}
