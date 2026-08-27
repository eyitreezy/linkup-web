import type { DbEscrowTransaction, DbPlan } from '@/types/database';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
export function isGroupSplitPlan(
  plan: Pick<DbPlan, 'is_group_plan' | 'escrow_pattern'> | null | undefined
): boolean {
  return !!plan?.is_group_plan && plan.escrow_pattern === 'B';
}

export function planTotalAmountCents(
  plan: Pick<
    DbPlan,
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
  >
): number {
  const storedTotal = plan.total_amount_cents ?? 0;
  if (storedTotal > 0) return storedTotal;
  const starting = plan.starting_price_cents ?? 0;
  const agreed = plan.agreed_price_cents ?? 0;
  const budget = plan.budget_max_cents ?? plan.budget_min_cents ?? 0;
  return Math.max(0, starting, agreed, budget);
}

export function projectedHostShareCents(
  plan: Pick<
    DbPlan,
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'accepted_guest_amounts_sum_cents'
  >
): number {
  const total = planTotalAmountCents(plan);
  const guestSum = plan.accepted_guest_amounts_sum_cents ?? 0;
  return Math.max(0, total - guestSum);
}

export function remainingGuestSlots(
  plan: Pick<DbPlan, 'max_guests' | 'accepted_guest_count'>
): number {
  const maxGuests = plan.max_guests ?? 0;
  const accepted = plan.accepted_guest_count ?? 0;
  return Math.max(0, maxGuests - accepted);
}

export function offerAgreedAmountCents(offer: {
  current_amount_cents?: number | null;
  amount_cents?: number | null;
}): number {
  return offer.current_amount_cents ?? offer.amount_cents ?? 0;
}

type GuestEscrowLeg = Pick<DbEscrowTransaction, 'guest_id' | 'guest_share_cents' | 'amount_cents'>;

type AcceptedOfferAmount = {
  current_amount_cents?: number | null;
  amount_cents?: number | null;
};

export function sumAcceptedOfferAmountsCents(offers: AcceptedOfferAmount[]): number {
  return offers.reduce(
    (sum, o) => sum + Math.max(0, o.current_amount_cents ?? o.amount_cents ?? 0),
    0
  );
}

export function sumAcceptedGuestEscrowCents(escrows: GuestEscrowLeg[]): number {
  const byGuest = new Map<string, number>();
  for (const e of escrows) {
    if (e.guest_id == null) continue;
    const amt = Math.max(0, e.guest_share_cents ?? e.amount_cents ?? 0);
    const prev = byGuest.get(e.guest_id) ?? 0;
    byGuest.set(e.guest_id, Math.max(prev, amt));
  }
  return [...byGuest.values()].reduce((sum, v) => sum + v, 0);
}

export function resolveAcceptedGuestCommitmentCents(
  plan: Pick<
    DbPlan,
    | 'accepted_guest_amounts_sum_cents'
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  acceptedOffers: AcceptedOfferAmount[] = []
): number {
  const fromPlan = plan.accepted_guest_amounts_sum_cents ?? 0;
  const fromOffers = sumAcceptedOfferAmountsCents(acceptedOffers);
  const fromRows = sumAcceptedGuestEscrowCents(guestEscrows);
  const total = planTotalAmountCents(plan);

  if (fromPlan > 0) {
    return total > 0 ? Math.min(fromPlan, total) : fromPlan;
  }
  if (fromOffers > 0) {
    return total > 0 ? Math.min(fromOffers, total) : fromOffers;
  }
  return total > 0 ? Math.min(fromRows, total) : fromRows;
}

export type ResolveGroupPlanTotalOptions = {
  hostEscrowRow?: Pick<DbEscrowTransaction, 'host_share_cents' | 'amount_cents'> | null;
  acceptedOffers?: AcceptedOfferAmount[];
};

/** Plan total for group split — uses price fields, then infers from commitments and suggested share. */
export function resolveGroupPlanTotalCents(
  plan: Pick<
    GroupSplitPlanSnapshot,
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'current_suggested_share_cents'
    | 'max_guests'
    | 'accepted_guest_count'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  options: ResolveGroupPlanTotalOptions = {}
): number {
  const fromFields = planTotalAmountCents(plan);
  if (fromFields > 0) return fromFields;

  const guestSum = resolveAcceptedGuestCommitmentCents(
    plan,
    guestEscrows,
    options.acceptedOffers ?? []
  );
  const hostStored = options.hostEscrowRow
    ? Math.max(0, options.hostEscrowRow.host_share_cents ?? options.hostEscrowRow.amount_cents ?? 0)
    : 0;

  if (guestSum > 0 && hostStored > 0) return guestSum + hostStored;

  const suggested = plan.current_suggested_share_cents ?? 0;
  const remainingSlots = remainingGuestSlots(plan) + 1;
  if (guestSum > 0 && suggested > 0 && remainingSlots > 0) {
    return guestSum + suggested * remainingSlots;
  }

  if (guestSum > 0) return guestSum + hostStored;

  return 0;
}

export function hostShareFromGuestCommitments(
  plan: Pick<
    DbPlan,
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'current_suggested_share_cents'
    | 'max_guests'
    | 'accepted_guest_count'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  acceptedOffers: AcceptedOfferAmount[] = [],
  options: ResolveGroupPlanTotalOptions = {}
): number {
  const total = resolveGroupPlanTotalCents(plan, guestEscrows, {
    ...options,
    acceptedOffers,
  });
  if (total <= 0) return 0;
  const guestSum = resolveAcceptedGuestCommitmentCents(plan, guestEscrows, acceptedOffers);
  return Math.max(0, total - guestSum);
}

export function isGroupHostCloseEscrowRow(
  plan: Pick<DbPlan, 'host_escrow_id'>,
  escrow: Pick<
    DbEscrowTransaction,
    'id' | 'guest_id' | 'host_share_cents' | 'amount_cents'
  > & { metadata?: DbEscrowTransaction['metadata'] }
): boolean {
  if (escrow.guest_id != null) return false;
  const hostShare = Math.max(0, escrow.host_share_cents ?? escrow.amount_cents ?? 0);
  if (hostShare <= 0) return false;

  const meta = escrow.metadata as { host_share_top_up?: boolean | string } | null | undefined;
  if (meta?.host_share_top_up === true || meta?.host_share_top_up === 'true') {
    return true;
  }

  if (plan.host_escrow_id) {
    return escrow.id === plan.host_escrow_id;
  }

  return true;
}

/** Orphan host-only pending row that is not the plan primary leg or a guest-remove top-up. */
export function isGhostHostEscrowRow(
  plan: Pick<DbPlan, 'host_escrow_id'>,
  escrow: Pick<
    DbEscrowTransaction,
    'id' | 'guest_id' | 'status' | 'metadata'
  >
): boolean {
  if (escrow.guest_id != null) return false;
  if (escrow.status !== 'pending_funding') return false;
  if (!plan.host_escrow_id || escrow.id === plan.host_escrow_id) return false;

  const meta = escrow.metadata as { host_share_top_up?: boolean | string } | null | undefined;
  if (meta?.host_share_top_up === true || meta?.host_share_top_up === 'true') {
    return false;
  }

  return true;
}

export type GroupHostShareResolution = {
  displayCents: number;
  paymentCents: number;
};

export type ResolveGroupHostShareOptions = {
  acceptedOffers?: AcceptedOfferAmount[];
  hostEscrowRow?: Pick<
    DbEscrowTransaction,
    'id' | 'host_share_cents' | 'amount_cents' | 'guest_id'
  > & { guest_share_cents?: number | null; metadata?: DbEscrowTransaction['metadata'] } | null;
};

function storedHostBudgetCents(
  escrow: Pick<DbEscrowTransaction, 'host_share_cents' | 'amount_cents'>
): number {
  return Math.max(0, escrow.host_share_cents ?? 0);
}

function storedHostGrossCents(
  escrow: Pick<DbEscrowTransaction, 'host_share_cents' | 'amount_cents'> & {
    guest_share_cents?: number | null;
  }
): number {
  const budget = storedHostBudgetCents(escrow);
  const guestBudget = Math.max(0, escrow.guest_share_cents ?? 0);
  if (budget > 0 && guestBudget > 0) return grossAmountCents(budget);
  return Math.max(0, escrow.amount_cents ?? 0);
}

export type GroupSplitPlanSnapshot = Pick<
  DbPlan,
  | 'total_amount_cents'
  | 'starting_price_cents'
  | 'agreed_price_cents'
  | 'budget_min_cents'
  | 'budget_max_cents'
  | 'accepted_guest_amounts_sum_cents'
  | 'current_suggested_share_cents'
  | 'max_guests'
  | 'accepted_guest_count'
  | 'host_escrow_id'
  | 'group_closed_at'
>;

export function resolveGroupHostShareCents(
  plan: GroupSplitPlanSnapshot,
  escrow: Pick<
    DbEscrowTransaction,
    'id' | 'host_share_cents' | 'amount_cents' | 'guest_id' | 'metadata'
  > & {
    guest_share_cents?: number | null;
  },
  guestEscrows: GuestEscrowLeg[] = [],
  options: ResolveGroupHostShareOptions = {}
): GroupHostShareResolution {
  const acceptedOffers = options.acceptedOffers ?? [];
  const resolveOpts: ResolveGroupPlanTotalOptions = {
    acceptedOffers,
    hostEscrowRow: options.hostEscrowRow,
  };
  const projected = projectedHostShareCents(plan);
  const live = hostShareFromGuestCommitments(plan, guestEscrows, acceptedOffers, resolveOpts);

  const storedEscrow = isGroupHostCloseEscrowRow(plan, escrow)
    ? escrow
    : options.hostEscrowRow && isGroupHostCloseEscrowRow(plan, options.hostEscrowRow)
      ? options.hostEscrowRow
      : null;
  const stored = storedEscrow ? storedHostBudgetCents(storedEscrow) : 0;
  const storedGross = storedEscrow ? storedHostGrossCents(storedEscrow) : 0;
  const topUpMeta = storedEscrow?.metadata as { host_share_top_up?: boolean | string } | null | undefined;
  const isHostTopUpEscrow =
    topUpMeta?.host_share_top_up === true || topUpMeta?.host_share_top_up === 'true';

  if (isHostTopUpEscrow && storedGross > 0) {
    return { displayCents: stored, paymentCents: storedGross };
  }

  if (plan.group_closed_at && storedGross > 0) {
    return { displayCents: stored, paymentCents: storedGross };
  }

  if (live > 0) {
    return { displayCents: live, paymentCents: grossAmountCents(live) };
  }
  if (storedGross > 0) {
    return { displayCents: stored, paymentCents: storedGross };
  }
  if (projected > 0) {
    return { displayCents: projected, paymentCents: grossAmountCents(projected) };
  }

  return { displayCents: 0, paymentCents: 0 };
}
