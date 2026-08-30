import { planTotalAmountCents } from '@/lib/plans/groupDynamicSplit';
import type { EscrowRoleSplit } from '@/lib/plans/escrowParties';
import type { DbPlan } from '@/types/database';

type GroupSplitPlan = Pick<DbPlan, 'creator_id' | 'max_guests' | 'accepted_guest_count' | 'escrow_pattern'>;

/** Host + max guest capacity (equal split divides total among all slots). */
export function groupPlanParticipantCount(plan: Pick<DbPlan, 'max_guests' | 'accepted_guest_count'>): number {
  const guestSlots = Math.max(1, plan.max_guests ?? 1);
  return guestSlots + 1;
}

/** Equal per-person share; host absorbs rounding remainder via ceil. */
export function groupPlanPerPersonCents(totalCents: number, participantCount: number): number {
  return Math.ceil(totalCents / Math.max(1, participantCount));
}

/**
 * Stable guest slot allocation from plan creation (equal split among host + max guest slots).
 * Does not change when other members pay or accept — separate from host Pay Your Share math.
 */
export function resolveStableGroupGuestAllocationCents(
  plan: Pick<
    DbPlan,
    | 'is_group_plan'
    | 'escrow_pattern'
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'max_guests'
    | 'accepted_guest_count'
  >
): number {
  if (!plan.is_group_plan || plan.escrow_pattern !== 'B') return 0;
  const total = planTotalAmountCents(plan);
  if (total <= 0) return 0;
  return groupPlanPerPersonCents(total, groupPlanParticipantCount(plan));
}

export function isGroupEqualSplitPlan(plan: Pick<DbPlan, 'is_group_plan' | 'escrow_pattern'>): boolean {
  return !!plan.is_group_plan && plan.escrow_pattern === 'B';
}

/**
 * Group plan + pattern B: total commitment split equally among host and all guest slots.
 * Host funds their share once (on the first escrow row that still needs it).
 */
export function resolveGroupSplitEscrowParties(
  plan: GroupSplitPlan,
  guestUserId: string,
  totalCents: number,
  hostShareAlreadyFunded: boolean
): EscrowRoleSplit {
  const participants = groupPlanParticipantCount(plan);
  const perPerson = groupPlanPerPersonCents(totalCents, participants);
  const hostId = plan.creator_id;

  return {
    payerId: hostId,
    payeeId: guestUserId,
    hostShareCents: hostShareAlreadyFunded ? 0 : perPerson,
    guestShareCents: perPerson,
  };
}
