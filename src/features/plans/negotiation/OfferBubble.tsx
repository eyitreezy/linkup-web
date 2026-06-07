'use client';

import { formatOfferAmount, formatProposalSnippet, offerStatusChip } from '@/features/plans/planDetailUtils';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlanOffer } from '@/types/database';
import { cn } from '@/utils/cn';

type Props = {
  offer: DbPlanOffer;
  bidderName: string;
  isOwn: boolean;
  isHost: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  acceptBusy?: boolean;
};

export function OfferBubble({
  offer,
  bidderName,
  isOwn,
  isHost,
  onAccept,
  onDecline,
  acceptBusy,
}: Props) {
  const chip = offerStatusChip(offer.status);
  const expired = isOfferExpired(offer);
  const canHostAct =
    isHost && !isOwn && (offer.status === 'pending' || offer.status === 'countered') && !expired;
  const whenSnippet = formatProposalSnippet(offer.proposed_scheduled_at);

  return (
    <div
      className={cn(
        'max-w-[min(100%,520px)] rounded-2xl border px-4 py-3 shadow-sm',
        isOwn
          ? 'ml-auto border-primary/20 bg-gradient-to-br from-[#EDE8FF] to-white'
          : 'mr-auto border-border/80 bg-white'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold text-foreground">{isOwn ? 'You' : bidderName}</p>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold', chip.className)}>
          {expired ? 'Expired' : chip.label}
        </span>
      </div>
      <p className="mt-1 text-[15px] font-extrabold text-primary">{formatOfferAmount(offer.amount_cents)}</p>
      {whenSnippet ? (
        <p className="text-[12px] font-semibold text-muted">Meet · {whenSnippet}</p>
      ) : null}
      {offer.message ? (
        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">{offer.message}</p>
      ) : null}
      {canHostAct && onAccept && onDecline ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={acceptBusy}
            onClick={onAccept}
            className="rounded-full linkup-gradient-primary px-4 py-2 text-[12px] font-extrabold text-white disabled:opacity-50"
          >
            Sounds good
          </button>
          <button
            type="button"
            disabled={acceptBusy}
            onClick={onDecline}
            className="rounded-full border border-border px-4 py-2 text-[12px] font-extrabold text-muted disabled:opacity-50"
          >
            Not quite
          </button>
        </div>
      ) : null}
    </div>
  );
}
