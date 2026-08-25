import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import type { DbPlan, DbEscrowTransaction } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanGuestEscrowSnapshot = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'status'
  | 'escrow_pattern'
  | 'payer_id'
  | 'host_id'
  | 'guest_id'
  | 'amount_cents'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'host_funded_at'
  | 'guest_funded_at'
>;

export type PlanPayShareState = {
  showPayShare: boolean;
  payShareEscrowId: string | null;
  payShareAmountLabel: string | null;
};

export type HostGroupPayShareState = PlanPayShareState & {
  /** Route to host agreement when the group must be closed before payment. */
  viaAgreement: boolean;
};

const INACTIVE_PLAN_STATUSES = new Set(['cancelled', 'draft']);

export function resolvePlanPayShareState(
  plan: Pick<DbPlan, 'status' | 'is_paid'>,
  userId: string | undefined,
  myGuestEscrow: PlanGuestEscrowSnapshot | null | undefined,
  isHost: boolean
): PlanPayShareState {
  const idle: PlanPayShareState = {
    showPayShare: false,
    payShareEscrowId: null,
    payShareAmountLabel: null,
  };

  if (!userId || isHost || !myGuestEscrow || !plan.is_paid) return idle;
  if (INACTIVE_PLAN_STATUSES.has(plan.status)) return idle;

  const funding = getEscrowFundingUiState(
    myGuestEscrow as Parameters<typeof getEscrowFundingUiState>[0],
    userId
  );
  if (!funding.canFund) return idle;

  return {
    showPayShare: true,
    payShareEscrowId: myGuestEscrow.id,
    payShareAmountLabel:
      funding.payAmountCents > 0 ? formatNGN(funding.payAmountCents) : null,
  };
}

export function resolveHostGroupPayShareState(
  plan: Pick<
    DbPlan,
    'status' | 'is_paid' | 'is_group_plan' | 'group_closed_at' | 'host_escrow_id'
  >,
  userId: string | undefined,
  hostEscrow: PlanGuestEscrowSnapshot | null | undefined,
  approvedGuestCount: number,
  isHost: boolean
): HostGroupPayShareState {
  const idle: HostGroupPayShareState = {
    showPayShare: false,
    payShareEscrowId: null,
    payShareAmountLabel: null,
    viaAgreement: false,
  };

  if (!userId || !isHost || !plan.is_paid || !plan.is_group_plan) return idle;
  if (INACTIVE_PLAN_STATUSES.has(plan.status)) return idle;
  if (approvedGuestCount <= 0) return idle;

  if (hostEscrow) {
    const funding = getEscrowFundingUiState(
      hostEscrow as Parameters<typeof getEscrowFundingUiState>[0],
      userId
    );
    if (!funding.canFund) return idle;
    return {
      showPayShare: true,
      payShareEscrowId: hostEscrow.id,
      payShareAmountLabel:
        funding.payAmountCents > 0 ? formatNGN(funding.payAmountCents) : null,
      viaAgreement: false,
    };
  }

  if (!plan.group_closed_at && !plan.host_escrow_id) {
    return {
      showPayShare: true,
      payShareEscrowId: null,
      payShareAmountLabel: null,
      viaAgreement: true,
    };
  }

  return idle;
}

/** Latest guest-leg escrow row for the viewer on this plan. */
export async function fetchViewerGuestEscrow(
  client: SupabaseClient,
  planId: string,
  viewerId: string
): Promise<PlanGuestEscrowSnapshot | null> {
  const { data } = await client
    .from('escrow_transactions')
    .select(
      'id, status, escrow_pattern, payer_id, host_id, guest_id, amount_cents, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'
    )
    .eq('plan_id', planId)
    .eq('guest_id', viewerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PlanGuestEscrowSnapshot | null) ?? null;
}

/** Host leg escrow for a group plan (after close group). */
export async function fetchHostGroupEscrow(
  client: SupabaseClient,
  plan: Pick<DbPlan, 'id' | 'creator_id' | 'host_escrow_id'>,
  hostId: string
): Promise<PlanGuestEscrowSnapshot | null> {
  const select =
    'id, status, escrow_pattern, payer_id, host_id, guest_id, amount_cents, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at';

  if (plan.host_escrow_id) {
    const { data } = await client
      .from('escrow_transactions')
      .select(select)
      .eq('id', plan.host_escrow_id)
      .maybeSingle();
    if (data) return data as PlanGuestEscrowSnapshot;
  }

  const { data } = await client
    .from('escrow_transactions')
    .select(select)
    .eq('plan_id', plan.id)
    .eq('payer_id', hostId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PlanGuestEscrowSnapshot | null) ?? null;
}
