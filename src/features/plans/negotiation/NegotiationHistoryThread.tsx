'use client';

import {
  formatRelativeTime,
  formatRoundActionHeadline,
  formatRoundAmount,
  formatRoundRoleLabel,
} from '@/lib/plans/formatNegotiationRound';
import { fetchOfferRounds } from '@/services/planOffers.service';
import { createClient } from '@/lib/supabase/client';
import type { DbPlanOfferRound } from '@/types/database';
import { useOfferRoundsRealtime } from '@/hooks/useOffersRealtime';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';

type Props = {
  offerId: string;
  currentUserId?: string;
  currency?: string;
};

function RoundRow({
  round,
  mine,
  currency,
}: {
  round: DbPlanOfferRound;
  mine: boolean;
  currency: string;
}) {
  const headline = formatRoundActionHeadline(round.action);
  const roleLabel = formatRoundRoleLabel(round.proposer_role, mine);
  const amountLabel = formatRoundAmount(round.amount_cents, currency);
  const relativeTime = formatRelativeTime(round.created_at);

  return (
    <div
      className={cn(
        'min-w-[240px] max-w-[92%] rounded-xl px-4 py-3 text-[13px]',
        mine
          ? 'ml-6 bg-foreground text-white'
          : 'mr-6 border border-border/80 bg-[#F3F4F6] text-foreground'
      )}
    >
      <div className="mb-2 flex w-full items-center justify-between gap-3">
        <p
          className={cn(
            'shrink-0 text-[10px] font-extrabold uppercase tracking-wide',
            mine ? 'text-white/65' : 'text-muted'
          )}
        >
          {roleLabel}
        </p>
        <p className={cn('shrink-0 text-[11px] font-semibold', mine ? 'text-white/70' : 'text-muted')}>
          {relativeTime}
        </p>
      </div>
      <p className="text-[14px] font-extrabold leading-snug">{headline}</p>
      <p
        className={cn(
          'mt-2.5 text-[17px] font-extrabold tracking-tight',
          mine ? 'text-white' : 'text-primary'
        )}
      >
        {amountLabel}
      </p>
      {round.note ? (
        <p className={cn('mt-2 text-[12px] font-semibold leading-relaxed', mine ? 'text-white/80' : 'text-muted')}>
          {round.note}
        </p>
      ) : null}
    </div>
  );
}

export function NegotiationHistoryThread({ offerId, currentUserId, currency = 'NGN' }: Props) {
  useOfferRoundsRealtime(offerId);

  const roundsQuery = useQuery({
    queryKey: ['offer-rounds', offerId],
    queryFn: async () => {
      const client = createClient();
      return fetchOfferRounds(client, offerId);
    },
    enabled: !!offerId,
    refetchInterval: false,
  });

  const rounds = roundsQuery.data ?? [];

  if (rounds.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border/80 pt-4">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Negotiation history</p>
      <div className="space-y-2">
        {rounds.map((round) => (
          <RoundRow
            key={round.id}
            round={round}
            mine={round.proposer_id === currentUserId}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}
