import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { planTotalAmountCents } from '@/lib/plans/groupDynamicSplit';
import { groupPlanParticipantCount, groupPlanPerPersonCents } from '@/lib/plans/groupEscrowSplit';
import type { DbPlan } from '@/types/database';

/** Display label for the formula slot price on non-negotiable plans. */
export function resolveJoinRequestSlotCentsLabel(plan: DbPlan): string {
  const currency = plan.currency ?? 'NGN';

  if (plan.escrow_pattern === 'C') {
    const cents = plan.starting_price_cents ?? 0;
    return formatEscrowMoney(cents, currency);
  }

  if (plan.escrow_pattern === 'B') {
    if (plan.is_group_plan) {
      const cents = plan.current_suggested_share_cents ?? 0;
      if (cents > 0) return formatEscrowMoney(cents, currency);
    } else {
      const total = plan.starting_price_cents ?? 0;
      const bps = plan.host_contribution_bps ?? 5000;
      const guestCents = Math.max(0, total - Math.floor((total * bps) / 10000));
      return formatEscrowMoney(guestCents, currency);
    }
  }

  return '';
}

export function resolveJoinRequestSlotCents(plan: DbPlan): number {
  if (plan.escrow_pattern === 'C') {
    return Math.max(0, plan.starting_price_cents ?? 0);
  }
  if (plan.escrow_pattern === 'B') {
    if (plan.is_group_plan) {
      return Math.max(0, plan.current_suggested_share_cents ?? 0);
    }
    const total = plan.starting_price_cents ?? 0;
    const bps = plan.host_contribution_bps ?? 5000;
    return Math.max(0, total - Math.floor((total * bps) / 10000));
  }
  return 0;
}

/** Default offer amount (budget cents) for a guest on a negotiable group plan. */
export function resolveDefaultGroupGuestOfferAmountCents(
  plan: Pick<
    DbPlan,
    | 'is_group_plan'
    | 'escrow_pattern'
    | 'current_suggested_share_cents'
    | 'starting_price_cents'
    | 'total_amount_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'max_guests'
    | 'accepted_guest_count'
    | 'host_contribution_bps'
  >
): number {
  if (!plan.is_group_plan) return 0;

  const suggested = plan.current_suggested_share_cents ?? 0;
  if (suggested > 0) return suggested;

  const slot = resolveJoinRequestSlotCents(plan as DbPlan);
  if (slot > 0) return slot;

  const total = planTotalAmountCents(plan);
  if (total > 0) {
    return groupPlanPerPersonCents(total, groupPlanParticipantCount(plan));
  }

  return Math.max(0, plan.starting_price_cents ?? 0);
}
