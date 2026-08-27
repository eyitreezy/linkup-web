import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { escrowRequiredLegsSatisfied } from '@/lib/escrow/escrowFundingStatus';
import { isGhostHostEscrowRow } from '@/lib/plans/groupDynamicSplit';
import type { DbEscrowTransaction, DbPlan, PlanStatus } from '@/types/database';

export type GroupEscrowFundingRow = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'guest_id'
  | 'host_id'
  | 'payer_id'
  | 'status'
  | 'escrow_pattern'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'host_share_cents'
  | 'guest_share_cents'
>;

const INACTIVE_ESCROW_STATUSES = new Set(['cancelled', 'refunded']);

export function isActiveGroupEscrowRow(
  escrow: Pick<GroupEscrowFundingRow, 'status'>
): boolean {
  return !INACTIVE_ESCROW_STATUSES.has(escrow.status);
}

export function activeGroupEscrowRows(
  escrows: GroupEscrowFundingRow[]
): GroupEscrowFundingRow[] {
  return escrows.filter(isActiveGroupEscrowRow);
}

function memberHasFunded(
  escrow: GroupEscrowFundingRow,
  memberUserId: string
): boolean {
  if (!isActiveGroupEscrowRow(escrow)) return false;
  return (
    userEscrowLegFunded(escrow, memberUserId) ||
    escrowRequiredLegsSatisfied(escrow)
  );
}

/** Host + max guest slots (full group plan size). */
export function groupPlanMemberCapacity(
  plan: Pick<DbPlan, 'max_guests'>
): number {
  return Math.max(1, (plan.max_guests ?? 0) + 1);
}

/** Host-only escrow rows for the plan creator (primary leg + optional top-up). */
function hostOnlyEscrowsForCreator(
  plan: Pick<DbPlan, 'creator_id'>,
  activeEscrows: GroupEscrowFundingRow[]
): GroupEscrowFundingRow[] {
  return activeEscrows.filter(
    (row) =>
      row.guest_id == null &&
      (row.payer_id === plan.creator_id || row.host_id === plan.creator_id)
  );
}

/** True when the host has completed at least one host-leg payment (ignores pending top-ups). */
function creatorHostLegFunded(
  plan: Pick<DbPlan, 'creator_id'>,
  activeEscrows: GroupEscrowFundingRow[]
): boolean {
  return hostOnlyEscrowsForCreator(plan, activeEscrows).some((row) =>
    memberHasFunded(row, plan.creator_id)
  );
}

/** Count host + guests who have funded their share on a group plan. */
export function countGroupFundedMembers(
  plan: Pick<DbPlan, 'creator_id' | 'host_escrow_id'>,
  escrows: GroupEscrowFundingRow[]
): number {
  const activeEscrows = activeGroupEscrowRows(escrows);
  let count = 0;

  if (creatorHostLegFunded(plan, activeEscrows)) {
    count += 1;
  }

  const guestIds = new Set<string>();
  for (const row of activeEscrows) {
    if (!row.guest_id || guestIds.has(row.guest_id)) continue;
    guestIds.add(row.guest_id);
    if (memberHasFunded(row, row.guest_id)) {
      count += 1;
    }
  }

  return count;
}

export function resolveGroupPlanDisplayStatus(
  plan: Pick<
    DbPlan,
    | 'status'
    | 'creator_id'
    | 'host_escrow_id'
    | 'is_group_plan'
    | 'accepted_guest_count'
    | 'max_guests'
  >,
  escrows: GroupEscrowFundingRow[]
): PlanStatus {
  if (!plan.is_group_plan) {
    return plan.status;
  }

  const activeEscrows = activeGroupEscrowRows(escrows);
  const relevantEscrows = activeEscrows.filter(
    (row) => !isGhostHostEscrowRow(plan, row)
  );
  const planCapacity = groupPlanMemberCapacity(plan);
  const fundedMembers = countGroupFundedMembers(plan, escrows);
  const rosterFilled = (plan.accepted_guest_count ?? 0) >= (plan.max_guests ?? 0);
  const allLegsSatisfied =
    relevantEscrows.length > 0 &&
    relevantEscrows.every((row) => escrowRequiredLegsSatisfied(row));

  const fullyFunded =
    rosterFilled &&
    fundedMembers >= planCapacity &&
    allLegsSatisfied;

  if (fullyFunded) {
    return 'active';
  }

  if (plan.status === 'active' || plan.status === 'awaiting_payment') {
    return 'awaiting_payment';
  }

  return plan.status;
}
