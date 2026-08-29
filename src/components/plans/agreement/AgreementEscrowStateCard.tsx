'use client';

import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { GroupSplitGuestSlotRow } from '@/components/plans/group/GroupSplitGuestSlotRow';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { isEscrowFullyFundedForMeet } from '@/lib/escrow/splitEscrowFunding';
import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import { resolveGroupGuestPaymentProgress, latestActiveGuestEscrowByUserId } from '@/lib/plans/groupPlanCapacity';
import type { AgreementEscrowRow, AgreementProfile } from '@/services/planAgreement.service';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import Link from 'next/link';
import { IoCheckmarkCircle, IoTimeOutline } from 'react-icons/io5';

type Props = {
  variant: 'waiting' | 'confirmed';
  plan: DbPlan;
  planId: string;
  isHost: boolean;
  viewerEscrow: AgreementEscrowRow | null;
  acceptedOffers?: DbPlanOffer[];
  guestEscrows?: AgreementEscrowRow[];
  guestProfiles?: AgreementProfile[];
  onOpenChat: () => void;
};

export function AgreementEscrowStateCard({
  variant,
  plan,
  planId,
  isHost,
  viewerEscrow,
  acceptedOffers = [],
  guestEscrows = [],
  guestProfiles = [],
  onOpenChat,
}: Props) {
  const isGroupSplit = isGroupSplitPlan(plan);
  const amountCents = viewerEscrow?.amount_cents ?? 0;
  const profileMap = new Map(guestProfiles.map((p) => [p.user_id, p]));
  const escrowByGuest = latestActiveGuestEscrowByUserId(guestEscrows);

  if (variant === 'confirmed') {
    return (
      <section className="linkup-card flex flex-col items-center gap-4 border-primary/10 p-8 text-center shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <IoCheckmarkCircle className="text-emerald-600" size={32} />
        </div>
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Meetup confirmed!</h2>
          <p className="mt-2 max-w-sm text-[14px] font-semibold leading-relaxed text-muted">
            All payments are secured. Your meetup is confirmed and ready to go.
          </p>
        </div>
        <div className="flex w-full max-w-md gap-3">
          <button
            type="button"
            onClick={onOpenChat}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white sm:text-[15px]"
          >
            Go to chat
          </button>
          <Link
            href={`/plan/${planId}`}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-primary/25 bg-white px-4 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 sm:text-[15px]"
          >
            View plan
          </Link>
        </div>
      </section>
    );
  }

  if (isHost && isGroupSplit && acceptedOffers.length > 0) {
    const rosterGuestIds = acceptedOffers.map((o) => o.bidder_id);
    const paymentProgress = resolveGroupGuestPaymentProgress(plan, guestEscrows, rosterGuestIds);
    const { fundedGuestCount, capacity, pendingGuestCount } = paymentProgress;
    const guestSlotTotal = Math.max(capacity.maxGuestSlots, rosterGuestIds.length);

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
          <IoCheckmarkCircle className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="text-[14px] font-extrabold text-emerald-800">Your payment is secured</p>
            {amountCents > 0 ? (
              <p className="text-[14px] font-semibold text-emerald-700">{formatNGN(amountCents)}</p>
            ) : null}
          </div>
        </div>

        <section className="linkup-card space-y-3 border-primary/10 p-5 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Guest payments · {fundedGuestCount} of {guestSlotTotal} guest slots complete
          </p>
          <p className="text-[11px] font-semibold text-muted">
            Group capacity: {Math.min(rosterGuestIds.length + 1, capacity.maxTotalMembers)} of{' '}
            {capacity.maxTotalMembers} members (host + guests)
          </p>
          <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
            {acceptedOffers.map((slotOffer) => {
              const prof = profileMap.get(slotOffer.bidder_id);
              return (
                <GroupSplitGuestSlotRow
                  key={slotOffer.id}
                  offer={slotOffer}
                  escrow={escrowByGuest.get(slotOffer.bidder_id)}
                  displayName={prof?.display_name?.trim() || 'Guest'}
                  avatarUrl={prof?.avatar_url ?? null}
                />
              );
            })}
          </div>
          {pendingGuestCount > 0 ? (
            <p className="text-[12px] font-semibold text-muted">
              {pendingGuestCount} guest
              {pendingGuestCount === 1 ? ' has' : 's have'} been notified to complete their payment.
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  const waitingCopy =
    !isHost && isGroupSplit
      ? 'Waiting for the host to close the group and complete their payment. You will be notified when the meetup is confirmed.'
      : isHost
        ? 'Waiting for the guest to fund their share. They have been notified.'
        : viewerEscrow && isEscrowFullyFundedForMeet(viewerEscrow)
          ? 'Your escrow payment is held securely. The meetup will be confirmed once all payments are complete.'
          : 'Your escrow payment is held securely. The meetup will be confirmed once all payments are complete.';

  return (
    <section className="linkup-card flex flex-col items-center gap-4 border-primary/10 p-8 text-center shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <IoCheckmarkCircle className="text-emerald-600" size={32} />
      </div>
      <div>
        <h2 className="font-display text-xl font-extrabold text-foreground">Your payment is secured</h2>
        {amountCents > 0 ? (
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{formatNGN(amountCents)}</p>
        ) : null}
        <p className="mt-3 max-w-sm text-[14px] font-semibold leading-relaxed text-muted">{waitingCopy}</p>
      </div>
      {viewerEscrow ? (
        <div className="flex items-center gap-2">
          <IoTimeOutline className="text-amber-600" size={18} />
          <EscrowStatusBadge status={viewerEscrow.status} />
        </div>
      ) : null}
      <Link
        href={`/plan/${planId}`}
        className="text-[14px] font-extrabold text-primary underline hover:opacity-80"
      >
        Back to plan
      </Link>
    </section>
  );
}
