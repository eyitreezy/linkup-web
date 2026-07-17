'use client';

import { formatEscrowMoney, patternLabel } from '@/lib/escrow/escrowPaymentPreview';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import type { EscrowPattern } from '@/types/database';
import { cn } from '@/utils/cn';
import {
  IoArrowForwardCircle,
  IoCheckmarkCircle,
  IoTimeOutline,
} from 'react-icons/io5';

type LegState = 'paid' | 'pending' | 'yours';

type Props = {
  pattern: EscrowPattern;
  amountCents: number;
  currency: string;
  fundingDeadlineIso: string | null | undefined;
  payerLabel: string;
  isCurrentUserPayer: boolean;
  payerFunded: boolean;
  isMoodPlan?: boolean;
  kicker?: string;
  title?: string;
  sub?: string;
};

export function EscrowSinglePayerFundingCard({
  pattern,
  amountCents,
  currency,
  fundingDeadlineIso,
  payerLabel,
  isCurrentUserPayer,
  payerFunded,
  isMoodPlan,
  kicker,
  title,
  sub,
}: Props) {
  const amount = formatEscrowMoney(amountCents, currency);
  const state: LegState = payerFunded ? 'paid' : isCurrentUserPayer ? 'yours' : 'pending';

  return (
    <section className="linkup-card overflow-hidden p-5 sm:p-6">
      <div className="mb-4 h-[3px] rounded-full bg-gradient-to-r from-primary/35 via-secondary/20 to-transparent" />
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
        {kicker ?? `${patternLabel(pattern)}${isMoodPlan ? ' · Mood plan' : ''}`}
      </p>
      <h3 className="mt-1 text-[17px] font-extrabold text-foreground">
        {title ?? (pattern === 'A' ? 'Host funds the full amount' : 'Guest funds the full amount')}
      </h3>
      <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-muted">
        {sub ??
          (isMoodPlan
            ? 'Mood plans require funding within 1 hour. Complete checkout on this screen.'
            : 'Complete checkout on this screen. Funds stay in escrow until the meetup is confirmed.')}
      </p>
      <div
        className={cn(
          'flex items-center justify-between border-t border-primary/10 py-4',
          state === 'yours' && '-mx-5 bg-primary/5 px-5 sm:-mx-6 sm:px-6'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-muted">{payerLabel}</p>
          <p className="font-display text-lg font-extrabold text-foreground">{amount}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-extrabold',
            state === 'paid' && 'bg-emerald-100 text-emerald-800',
            state === 'yours' && 'bg-[#EDE8FF] text-primary',
            state === 'pending' && 'bg-muted/10 text-muted'
          )}
        >
          {state === 'paid' ? (
            <IoCheckmarkCircle size={16} />
          ) : state === 'yours' ? (
            <IoArrowForwardCircle size={16} />
          ) : (
            <IoTimeOutline size={16} />
          )}
          {state === 'paid' ? 'Paid' : state === 'yours' ? 'Your turn' : 'Pending'}
        </span>
      </div>
      {fundingDeadlineIso ? (
        <p className="mt-2 text-[13px] font-semibold text-muted">
          Fund by {formatIsoDateTime(fundingDeadlineIso)}
        </p>
      ) : null}
    </section>
  );
}
