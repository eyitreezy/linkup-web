'use client';

import { OfferStatusBadge } from '@/components/plans/OfferStatusBadge';
import { formatOfferAmount, formatProposalSnippet } from '@/features/plans/planDetailUtils';
import { offerLiveAmount } from '@/lib/plans/negotiationState';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlanOffer } from '@/types/database';
import { cn } from '@/utils/cn';

type Props = {
  offer: DbPlanOffer;
  bidderName: string;
  isOwn: boolean;
  isHost: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

export function OfferBubble({ offer, bidderName, isOwn, isHost, selected, onSelect }: Props) {
  const expired = isOfferExpired(offer);
  const whenSnippet = formatProposalSnippet(offer.proposed_scheduled_at);
  const liveAmount = offerLiveAmount(offer);

  const inner = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold text-foreground">{isOwn ? 'You' : bidderName}</p>
        <OfferStatusBadge status={offer.status} expired={expired} />
      </div>
      <p className="mt-1 text-[15px] font-extrabold text-primary">{formatOfferAmount(liveAmount)}</p>
      {whenSnippet ? (
        <p className="text-[12px] font-semibold text-muted">Meet · {whenSnippet}</p>
      ) : null}
      {offer.message ? (
        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">{offer.message}</p>
      ) : null}
      {isHost && onSelect ? (
        <p className="mt-2 text-[11px] font-extrabold text-primary">
          {selected ? 'Selected for negotiation' : 'Tap to negotiate'}
        </p>
      ) : null}
    </>
  );

  const className = cn(
    'w-full rounded-2xl border px-4 py-3 shadow-sm transition',
    isOwn
      ? 'border-primary/20 bg-gradient-to-br from-[#EDE8FF] to-white sm:col-start-2'
      : 'border-border/80 bg-white',
    selected && 'ring-2 ring-primary/40',
    onSelect && 'cursor-pointer hover:border-primary/30'
  );

  if (onSelect) {
    return (
      <button type="button" className={cn(className, 'text-left')} onClick={onSelect}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
