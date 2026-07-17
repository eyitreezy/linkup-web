'use client';

import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { cn } from '@/utils/cn';
import {
  IoArrowForwardCircle,
  IoCheckmarkCircle,
  IoTimeOutline,
} from 'react-icons/io5';

type LegState = 'paid' | 'pending' | 'yours';

function LegRow({
  label,
  cents,
  currency,
  state,
}: {
  label: string;
  cents: number;
  currency: string;
  state: LegState;
}) {
  const amount = formatEscrowMoney(cents, currency);
  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-primary/10 py-4 first:border-t-0',
        state === 'yours' && '-mx-5 bg-primary/5 px-5 sm:-mx-6 sm:px-6'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-muted">{label}</p>
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
  );
}

type Props = {
  hostShareCents: number;
  guestShareCents: number;
  hostFunded: boolean;
  guestFunded: boolean;
  currency: string;
  fundingDeadlineIso: string | null | undefined;
  currentUserIsHost: boolean;
  kicker?: string;
  title?: string;
  sub?: string;
  hostLegLabel?: string;
  guestLegLabel?: string;
};

export function EscrowSplitFundingCard({
  hostShareCents,
  guestShareCents,
  hostFunded,
  guestFunded,
  currency,
  fundingDeadlineIso,
  currentUserIsHost,
  kicker,
  title,
  sub,
  hostLegLabel,
  guestLegLabel,
}: Props) {
  const hostState: LegState = hostFunded ? 'paid' : currentUserIsHost ? 'yours' : 'pending';
  const guestState: LegState = guestFunded ? 'paid' : !currentUserIsHost ? 'yours' : 'pending';

  return (
    <section className="linkup-card overflow-hidden p-5 sm:p-6">
      <div className="mb-4 h-[3px] rounded-full bg-gradient-to-r from-primary/35 via-secondary/20 to-transparent" />
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
        {kicker ?? 'Pattern B · split escrow'}
      </p>
      <h3 className="mt-1 text-[17px] font-extrabold text-foreground">
        {title ?? 'Each person pays their share here'}
      </h3>
      <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-muted">
        {sub ??
          'Payments happen on this screen only, not during negotiation. Both legs must complete before the plan goes active.'}
      </p>
      <LegRow
        label={hostLegLabel ?? 'Host share'}
        cents={hostShareCents}
        currency={currency}
        state={hostState}
      />
      <LegRow
        label={guestLegLabel ?? 'Guest share'}
        cents={guestShareCents}
        currency={currency}
        state={guestState}
      />
      {fundingDeadlineIso ? (
        <p className="mt-2 text-[13px] font-semibold text-muted">
          Fund by {formatIsoDateTime(fundingDeadlineIso)}
        </p>
      ) : null}
    </section>
  );
}
