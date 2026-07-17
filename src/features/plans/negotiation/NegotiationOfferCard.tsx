'use client';

import { OfferStatusBadge } from '@/components/plans/OfferStatusBadge';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { resolvePlanAgreementHref } from '@/lib/plans/planAgreementRoute';
import { deriveNegotiationContext, offerLiveAmount } from '@/lib/plans/negotiationState';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import Link from 'next/link';
import { IoTimeOutline } from 'react-icons/io5';
import { NegotiationHistoryThread } from '@/features/plans/negotiation/NegotiationHistoryThread';

type Props = {
  offer: DbPlanOffer;
  plan: DbPlan;
  currentUserId?: string;
  bidderName?: string;
  busy?: boolean;
  onAccept: () => void;
  onCounter: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
};

export function NegotiationOfferCard({
  offer,
  plan,
  currentUserId,
  bidderName,
  busy,
  onAccept,
  onCounter,
  onDecline,
  onWithdraw,
}: Props) {
  const { isHost, isMyTurn, isOthersTurn, isLive, canWithdraw } = deriveNegotiationContext(
    offer,
    plan,
    currentUserId
  );
  const expired = isOfferExpired(offer);
  const amount = offerLiveAmount(offer);
  const isAccepted = offer.status === 'accepted';
  const agreementHref = resolvePlanAgreementHref(plan, { offerId: offer.id });

  return (
    <div className="linkup-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {isLive && !expired ? 'Offer on the table' : 'Final offer'}
            {bidderName && isHost ? ` · ${bidderName}` : null}
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-foreground">
            {amount != null && amount > 0 ? formatNGN(amount) : 'Open amount'}
          </p>
        </div>
        <OfferStatusBadge status={offer.status} expired={expired} />
      </div>

      {isAccepted ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={agreementHref}
            className="flex-1 rounded-full linkup-gradient-primary py-2.5 text-center text-[14px] font-extrabold text-white transition hover:opacity-95"
          >
            View agreement
          </Link>
        </div>
      ) : null}

      {!isAccepted && isLive && isMyTurn && !expired ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="flex-1 rounded-full linkup-gradient-primary py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCounter}
            className="flex-1 rounded-full border border-primary/25 py-2.5 text-[14px] font-extrabold text-primary disabled:opacity-50"
          >
            Counter
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="flex-1 rounded-full border border-red-200 py-2.5 text-[14px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : null}

      {!isAccepted && canWithdraw && !expired ? (
        <button
          type="button"
          disabled={busy}
          onClick={onWithdraw}
          className="text-[13px] font-semibold text-muted underline hover:text-foreground disabled:opacity-50"
        >
          Withdraw my offer
        </button>
      ) : null}

      {!isAccepted && isLive && isOthersTurn && !expired ? (
        <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          <IoTimeOutline size={16} aria-hidden />
          <span>Waiting for the {isHost ? 'guest' : 'host'} to respond</span>
        </div>
      ) : null}

      <NegotiationHistoryThread
        offerId={offer.id}
        currentUserId={currentUserId}
        currency={plan.currency}
      />
    </div>
  );
}
