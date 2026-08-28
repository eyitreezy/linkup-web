'use client';

import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { closeGroupAndPayHostShare } from '@/lib/plans/closeGroupEscrow';
import {
  isGroupSplitPlan,
  planTotalAmountCents,
  projectedHostShareCents,
  resolveHostGroupContribution,
  remainingGuestSlots,
} from '@/lib/plans/groupDynamicSplit';
import { createClient } from '@/lib/supabase/client';
import type { DbEscrowTransaction, DbPlan } from '@/types/database';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IoCheckmarkCircle } from 'react-icons/io5';

type Props = {
  plan: DbPlan;
  planId: string;
  userId: string;
  hostEscrow?: Pick<DbEscrowTransaction, 'id' | 'amount_cents' | 'host_share_cents' | 'status'> | null;
  onError: (message: string) => void;
};

export function GroupHostManageSection({ plan, planId, userId, hostEscrow, onError }: Props) {
  const queryClient = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!isGroupSplitPlan(plan)) return null;

  const groupClosed = !!plan.group_closed_at;
  const projected = projectedHostShareCents(plan);
  const hostContribution = resolveHostGroupContribution(plan, [], {
    hostEscrowRow: hostEscrow ? { ...hostEscrow, guest_id: null } : null,
  });
  const hostSharePaymentCents = hostContribution.paymentCents;
  const acceptedCount = plan.accepted_guest_count ?? 0;
  const openSlots = remainingGuestSlots(plan);
  const total = planTotalAmountCents(plan);

  async function handleCloseGroup() {
    setClosing(true);
    try {
      const client = createClient();
      const res = await closeGroupAndPayHostShare(client, planId, userId);
      if (!res.ok) {
        onError(res.error ?? 'Something went wrong. Please try again.');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-agreement', planId] });
    } catch {
      onError('Something went wrong. Please try again.');
    } finally {
      setClosing(false);
      setCloseOpen(false);
    }
  }

  if (groupClosed) {
    const shareBudgetCents = hostEscrow?.host_share_cents ?? hostContribution.displayCents ?? projected;
    const hostPaid = hostEscrow?.status === 'funded' || hostEscrow?.status === 'active';
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
        <IoCheckmarkCircle className="mt-0.5 shrink-0 text-emerald-600" size={20} />
        <p className="text-[14px] font-semibold leading-relaxed text-emerald-800">
          {hostPaid
            ? `Group closed. You paid ${formatNGN(hostSharePaymentCents)}. Waiting for guests to fund their shares.`
            : `Group closed. Your share is ${formatNGN(shareBudgetCents)} (${formatNGN(hostSharePaymentCents)} at checkout). Complete your payment to activate the plan.`}
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="linkup-card space-y-3 border-primary/10 p-5 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Your projected share</p>
        <p className="font-display text-3xl font-extrabold text-foreground">{formatNGN(projected)}</p>
        <p className="text-[13px] font-semibold text-muted">
          Checkout total: {formatNGN(hostSharePaymentCents)} (incl. platform fee)
        </p>
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          You pay this once when you close the group. It equals the plan total ({formatNGN(total)}) minus what your{' '}
          {acceptedCount} {acceptedCount === 1 ? 'guest has' : 'guests have'} committed to.
        </p>
        {openSlots > 0 ? (
          <p className="text-[12px] font-semibold text-muted">
            {openSlots} slot{openSlots === 1 ? '' : 's'} still open. Accepting more guests may reduce your share.
          </p>
        ) : null}
      </section>

      {acceptedCount > 0 ? (
        <button
          type="button"
          onClick={() => setCloseOpen(true)}
          className="w-full rounded-full border border-primary/25 px-6 py-3 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50"
        >
          Close group and pay my share
        </button>
      ) : null}

      <ConfirmDialog
        open={closeOpen}
        title="Close group?"
        message={`You have ${acceptedCount} guest${acceptedCount === 1 ? '' : 's'} confirmed. Your share will be ${formatNGN(hostSharePaymentCents)} at checkout (${formatNGN(projected)} contribution). No more guests can join after you close. This cannot be undone.`}
        cancelLabel="Cancel"
        confirmLabel={closing ? 'Processing…' : 'Close and pay'}
        busy={closing}
        onClose={() => !closing && setCloseOpen(false)}
        onConfirm={() => void handleCloseGroup()}
      />
    </>
  );
}
