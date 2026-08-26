'use client';

import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { GroupSplitGuestSlotRow } from '@/components/plans/group/GroupSplitGuestSlotRow';
import { formatNGN, formatEscrowDate } from '@/lib/escrow/escrowFormatters';
import { closeGroupAndCreateHostEscrow } from '@/lib/plans/closeGroupEscrow';
import {
  isGroupSplitPlan,
  offerAgreedAmountCents,
  planTotalAmountCents,
  projectedHostShareCents,
} from '@/lib/plans/groupDynamicSplit';
import { resolveEscrowHref } from '@/lib/plans/planAgreementRoute';
import { createClient } from '@/lib/supabase/client';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IoCheckmarkCircle, IoTimeOutline } from 'react-icons/io5';

type EscrowSummary = Pick<
  DbEscrowTransaction,
  'id' | 'guest_id' | 'amount_cents' | 'status' | 'escrow_pattern' | 'plan_id' | 'host_id' | 'payer_id' | 'host_funded_at' | 'guest_funded_at' | 'host_share_cents' | 'guest_share_cents' | 'funding_deadline'
>;

type ProfileSummary = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  plan: DbPlan;
  planId: string;
  userId: string;
  userEmail: string | null | undefined;
  isHost: boolean;
  myOffer: DbPlanOffer | null;
  myEscrow: EscrowSummary | null;
  hostEscrow: EscrowSummary | null;
  acceptedOffers: DbPlanOffer[];
  guestEscrows: EscrowSummary[];
  guestProfiles: ProfileSummary[];
  onError: (message: string) => void;
  onFunded?: () => void;
};

export function GroupSplitAgreementSection({
  plan,
  planId,
  userId,
  isHost,
  myOffer,
  myEscrow,
  hostEscrow,
  acceptedOffers,
  guestEscrows,
  guestProfiles,
  onError,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!isGroupSplitPlan(plan)) return null;

  const groupClosed = !!plan.group_closed_at;
  const projected = projectedHostShareCents(plan);
  const total = planTotalAmountCents(plan);
  const offerId = myOffer?.id ?? null;

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileSummary>();
    for (const p of guestProfiles) map.set(p.user_id, p);
    return map;
  }, [guestProfiles]);

  const escrowByGuest = useMemo(() => {
    const map = new Map<string, EscrowSummary>();
    for (const e of guestEscrows) {
      if (e.guest_id) map.set(e.guest_id, e);
    }
    return map;
  }, [guestEscrows]);

  async function handleCloseGroup() {
    setClosing(true);
    try {
      const client = createClient();
      const res = await closeGroupAndCreateHostEscrow(client, planId);
      if (!res.ok || !res.hostEscrowId) {
        onError(res.error ?? 'Something went wrong. Please try again.');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['plan-agreement', planId] });
      router.push(resolveEscrowHref(res.hostEscrowId, { planId, offerId }));
    } catch {
      onError('Something went wrong. Please try again.');
    } finally {
      setClosing(false);
      setCloseOpen(false);
    }
  }

  if (!isHost) {
    const shareCents = myEscrow?.amount_cents ?? (myOffer ? offerAgreedAmountCents(myOffer) : 0);
    const escrowHref =
      myEscrow?.id && myEscrow.status === 'pending_funding'
        ? resolveEscrowHref(myEscrow.id, { planId, offerId })
        : null;
    const sharePaid = myEscrow?.status === 'funded' || myEscrow?.status === 'active';

    return (
      <section className="linkup-card relative space-y-3 overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/10 to-transparent"
          aria-hidden
        />
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Group plan · Split escrow</p>
        <h3 className="font-display text-lg font-extrabold text-foreground">
          Fund your negotiated share to confirm your slot
        </h3>
        <p className="text-[14px] font-semibold text-muted">
          Your share is the amount you and the host agreed during negotiation. Once you fund it, your slot is secured.
          The plan activates after all shares are funded.
        </p>

        {myEscrow?.funding_deadline ? (
          <p className="text-[13px] font-semibold text-muted">
            Fund by {formatEscrowDate(myEscrow.funding_deadline)}
          </p>
        ) : null}

        <div className="rounded-xl border border-border/80 px-3 py-2">
          <p className="text-[11px] font-extrabold uppercase text-muted">Your agreed share</p>
          <p className="font-extrabold">{formatNGN(myEscrow?.amount_cents ?? shareCents)}</p>
          <p className="text-[12px] font-semibold text-muted">Negotiated and agreed with the host.</p>
          <p className={`mt-1 text-[12px] font-semibold ${sharePaid ? 'text-emerald-700' : 'text-amber-700'}`}>
            {sharePaid ? 'Paid' : 'Pending your payment'}
          </p>
        </div>

        {escrowHref && shareCents > 0 ? (
          <Link
            href={escrowHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full linkup-gradient-primary px-5 py-3 text-[14px] font-extrabold text-white"
          >
            Fund your share · {formatNGN(shareCents)}
          </Link>
        ) : null}

        {sharePaid ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <IoCheckmarkCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} />
            <p className="text-[13px] font-semibold text-emerald-800">Your share is secured.</p>
          </div>
        ) : null}

        {sharePaid && plan.status !== 'active' ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <IoTimeOutline className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <p className="text-[13px] font-semibold text-amber-800">
              Waiting for the host to close the group and complete their payment.
            </p>
          </div>
        ) : null}

        <ul className="space-y-2 text-[14px] font-semibold leading-relaxed text-muted">
          <li>Your payment is held securely in LinkUp escrow until the meetup is confirmed.</li>
          <li>The plan activates once all guests and the host have funded their shares.</li>
          <li>Funds are released according to the plan rules after the meetup is confirmed.</li>
        </ul>
      </section>
    );
  }

  const hostShareCents = hostEscrow?.amount_cents ?? projected;
  const hostSharePaid = hostEscrow?.status === 'funded' || hostEscrow?.status === 'active';
  const isGroupHostBeforeClose = !groupClosed && !plan.host_escrow_id;

  const hostEscrowHref =
    hostEscrow?.id && hostEscrow.status === 'pending_funding' && groupClosed && hostShareCents > 0
      ? resolveEscrowHref(hostEscrow.id, { planId, offerId })
      : null;

  if (isGroupHostBeforeClose) {
    return (
      <div className="space-y-3">
        <section className="linkup-card relative space-y-3 overflow-hidden p-5 text-center">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/10 to-transparent"
            aria-hidden
          />
          <p className="font-display text-lg font-extrabold text-foreground">Close the group first</p>
          <p className="mx-auto max-w-sm text-[14px] font-semibold leading-relaxed text-muted">
            Your share as host is calculated once you close the group to new guests. Review your projected share
            below and close the group to proceed to payment.
          </p>
        </section>

        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Guest contributions</p>

        <div className="linkup-card divide-y divide-border/60 overflow-hidden border-primary/10 p-0 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
          {acceptedOffers.length === 0 ? (
            <p className="p-4 text-[13px] font-semibold text-muted">No accepted guests yet.</p>
          ) : (
            acceptedOffers.map((offer) => {
              const prof = profileMap.get(offer.bidder_id);
              return (
                <GroupSplitGuestSlotRow
                  key={offer.id}
                  offer={offer}
                  escrow={escrowByGuest.get(offer.bidder_id)}
                  displayName={prof?.display_name?.trim() || 'Guest'}
                  avatarUrl={prof?.avatar_url ?? null}
                />
              );
            })
          )}
        </div>

        <div className="linkup-card border-primary/10 p-4 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-muted">Your share</p>
            <p className="text-[14px] font-extrabold text-muted">
              {formatNGN(projected)} <span className="font-semibold">(projected)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-[14px] font-semibold text-muted">Plan total</p>
          <p className="text-[14px] font-extrabold text-foreground">{formatNGN(total)}</p>
        </div>

        {acceptedOffers.length > 0 ? (
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
          message={`You have ${acceptedOffers.length} guest${acceptedOffers.length === 1 ? '' : 's'} confirmed. Your share will be ${formatNGN(projected)}. No more guests can join after you close. This cannot be undone.`}
          cancelLabel="Cancel"
          confirmLabel={closing ? 'Processing…' : 'Close and pay'}
          busy={closing}
          onClose={() => !closing && setCloseOpen(false)}
          onConfirm={() => void handleCloseGroup()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="linkup-card relative space-y-3 overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/10 to-transparent"
          aria-hidden
        />
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Group plan · Split escrow</p>
        <h3 className="font-display text-lg font-extrabold text-foreground">
          Pay your host share to activate the plan
        </h3>
        <p className="text-[14px] font-semibold text-muted">
          Your share was calculated from the plan total after all guests committed their amounts. The plan activates
          once all guests and your share are funded.
        </p>

        {hostEscrow?.funding_deadline ? (
          <p className="text-[13px] font-semibold text-muted">
            Fund by {formatEscrowDate(hostEscrow.funding_deadline)}
          </p>
        ) : null}

        <div className="rounded-xl border border-border/80 px-3 py-2">
          <p className="text-[11px] font-extrabold uppercase text-muted">Your host share</p>
          <p className="font-extrabold">{formatNGN(groupClosed ? hostShareCents : projected)}</p>
          {!groupClosed ? (
            <p className="text-[12px] font-semibold text-muted">Projected until you close the group.</p>
          ) : null}
          <p className={`mt-1 text-[12px] font-semibold ${hostSharePaid ? 'text-emerald-700' : 'text-amber-700'}`}>
            {hostSharePaid ? 'Paid' : groupClosed ? 'Pending your payment' : 'Close the group to pay'}
          </p>
        </div>

        {hostEscrowHref ? (
          <Link
            href={hostEscrowHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full linkup-gradient-primary px-5 py-3 text-[14px] font-extrabold text-white"
          >
            Pay your share · {formatNGN(hostShareCents)}
          </Link>
        ) : null}

        <ul className="space-y-2 text-[14px] font-semibold leading-relaxed text-muted">
          <li>Your payment is held securely in LinkUp escrow until the meetup is confirmed.</li>
          <li>
            The plan activates once all guests have funded their individual shares and your share is received.
          </li>
          <li>Funds are released according to the plan rules after the meetup is confirmed.</li>
        </ul>
      </section>

      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Guest contributions</p>

      <div className="linkup-card divide-y divide-border/60 overflow-hidden border-primary/10 p-0 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
        {acceptedOffers.length === 0 ? (
          <p className="p-4 text-[13px] font-semibold text-muted">No accepted guests yet.</p>
        ) : (
          acceptedOffers.map((offer) => {
            const prof = profileMap.get(offer.bidder_id);
            return (
              <GroupSplitGuestSlotRow
                key={offer.id}
                offer={offer}
                escrow={escrowByGuest.get(offer.bidder_id)}
                displayName={prof?.display_name?.trim() || 'Guest'}
                avatarUrl={prof?.avatar_url ?? null}
              />
            );
          })
        )}
      </div>

      <div className="linkup-card border-primary/10 p-4 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-muted">Your share</p>
          {groupClosed ? (
            <p className="text-[14px] font-extrabold text-foreground">{formatNGN(hostShareCents)}</p>
          ) : (
            <p className="text-[14px] font-extrabold text-muted">
              {formatNGN(projected)} <span className="font-semibold">(projected)</span>
            </p>
          )}
        </div>
        {hostEscrow ? (
          <div className="mt-2 flex justify-end">
            <EscrowStatusBadge status={hostEscrow.status} />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[14px] font-semibold text-muted">Plan total</p>
        <p className="text-[14px] font-extrabold text-foreground">{formatNGN(total)}</p>
      </div>

      {!groupClosed && acceptedOffers.length > 0 ? (
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
        message={`You have ${acceptedOffers.length} guest${acceptedOffers.length === 1 ? '' : 's'} confirmed. Your share will be ${formatNGN(projected)}. No more guests can join after you close. This cannot be undone.`}
        cancelLabel="Cancel"
        confirmLabel={closing ? 'Processing…' : 'Close and pay'}
        busy={closing}
        onClose={() => !closing && setCloseOpen(false)}
        onConfirm={() => void handleCloseGroup()}
      />
    </div>
  );
}
