import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { escrowRequiredLegsSatisfied } from '@/lib/escrow/escrowFundingStatus';
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

/** Count host + guests who have funded their share on a group plan. */
export function countGroupFundedMembers(
  plan: Pick<DbPlan, 'creator_id' | 'host_escrow_id'>,
  escrows: GroupEscrowFundingRow[]
): number {
  const activeEscrows = activeGroupEscrowRows(escrows);
  let count = 0;

  const hostEscrow =
    (plan.host_escrow_id
      ? activeEscrows.find((row) => row.id === plan.host_escrow_id)
      : null) ??
    activeEscrows.find(
      (row) =>
        row.guest_id == null &&
        (row.payer_id === plan.creator_id || row.host_id === plan.creator_id)
    );

  if (hostEscrow && memberHasFunded(hostEscrow, plan.creator_id)) {
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
    'status' | 'creator_id' | 'host_escrow_id' | 'is_group_plan' | 'accepted_guest_count'
  >,
  escrows: GroupEscrowFundingRow[]
): PlanStatus {
  if (!plan.is_group_plan) {
    return plan.status;
  }

  const activeEscrows = activeGroupEscrowRows(escrows);
  if (activeEscrows.length === 0) {
    return plan.status === 'active' ? 'awaiting_payment' : plan.status;
  }

  const expectedMembers = Math.max(1, (plan.accepted_guest_count ?? 0) + 1);
  const fundedMembers = countGroupFundedMembers(plan, activeEscrows);
  const allLegsSatisfied = activeEscrows.every((row) => escrowRequiredLegsSatisfied(row));
  const fullyFunded = fundedMembers >= expectedMembers && allLegsSatisfied;

  if (fullyFunded) {
    return 'active';
  }

  if (plan.status === 'active' || plan.status === 'awaiting_payment') {
    return 'awaiting_payment';
  }

  return plan.status;
}
