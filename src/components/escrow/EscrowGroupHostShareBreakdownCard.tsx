'use client';

import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import Link from 'next/link';
import { IoCheckmarkCircle, IoHourglassOutline, IoPeople } from 'react-icons/io5';

type Props = {
  planTotalCents: number;
  guestsCommittedCents: number;
  hostShareCents: number;
  hostPayGrossCents?: number;
  platformFeeCents?: number;
  currency: string;
  groupClosed: boolean;
  hostShareFunded: boolean;
  hostEscrowHref?: string | null;
};

export function EscrowGroupHostShareBreakdownCard({
  planTotalCents,
  guestsCommittedCents,
  hostShareCents,
  hostPayGrossCents,
  platformFeeCents,
  currency,
  groupClosed,
  hostShareFunded,
  hostEscrowHref,
}: Props) {
  const fmt = (cents: number) => formatEscrowMoney(cents, currency);
  const hostCheckoutCents =
    hostPayGrossCents != null && hostPayGrossCents > 0
      ? hostPayGrossCents
      : grossAmountCents(hostShareCents);
  const feeCents =
    platformFeeCents != null && platformFeeCents > 0
      ? platformFeeCents
      : Math.max(0, hostCheckoutCents - hostShareCents);
  const showCheckoutBreakdown = feeCents > 0 && hostCheckoutCents !== hostShareCents;

  return (
    <section className="linkup-card relative space-y-4 overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-secondary/10 via-primary/5 to-transparent"
        aria-hidden
      />
      <div className="relative">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
          Group plan · Host share
        </p>
        <div className="relative mt-1 inline-block max-w-full">
          {!hostShareFunded ? (
            <IoHourglassOutline
              size={56}
              className="animate-hourglass pointer-events-none absolute -right-1 top-1/2 -z-0 -translate-y-1/2 text-primary/10 sm:-right-2 sm:size-[4.5rem]"
              aria-hidden
            />
          ) : null}
          <h3 className="relative z-10 font-display text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
            Your host share
          </h3>
        </div>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
          In a group split plan, each guest pays their negotiated share into escrow. Your host share is the
          remainder: the plan total minus what accepted guests have committed so far.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-white/90 shadow-[0_8px_18px_rgba(42,31,85,0.06)]">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5 sm:px-5">
          <span className="text-[13px] font-semibold text-muted">Plan total</span>
          <span className="font-display text-base font-extrabold text-foreground sm:text-lg">
            {fmt(planTotalCents)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5 sm:px-5">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <IoPeople size={15} className="shrink-0 text-secondary" aria-hidden />
            Guests committed
          </span>
          <span className="font-display text-base font-extrabold text-muted sm:text-lg">
            − {fmt(guestsCommittedCents)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-[#EDE8FF]/80 to-[#F3EEFF]/50 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
              Your host share
            </p>
            {!groupClosed ? (
              <p className="mt-1 text-[12px] font-semibold text-muted">
                Your contribution (excl. fee). Updates as more guests join.
              </p>
            ) : (
              <p className="mt-1 text-[12px] font-semibold text-muted">
                Your contribution (excl. fee) after closing the group
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="font-display text-xl font-extrabold text-primary sm:text-2xl">
              {fmt(hostShareCents)}
            </p>
            {hostShareFunded ? (
              <IoCheckmarkCircle size={22} className="text-emerald-600" aria-hidden />
            ) : (
              <IoHourglassOutline
                size={22}
                className="animate-hourglass text-amber-600"
                aria-hidden
              />
            )}
          </div>
        </div>
        {showCheckoutBreakdown ? (
          <>
            <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3.5 sm:px-5">
              <span className="text-[13px] font-semibold text-muted">Platform fee (5%)</span>
              <span className="font-display text-base font-extrabold text-muted sm:text-lg">
                + {fmt(feeCents)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 bg-[#F8F7FC] px-4 py-3.5 sm:px-5">
              <span className="text-[13px] font-extrabold text-foreground">Total at checkout</span>
              <span className="font-display text-base font-extrabold text-foreground sm:text-lg">
                {fmt(hostCheckoutCents)}
              </span>
            </div>
          </>
        ) : null}
      </div>

      <p
        className={`text-[13px] font-semibold ${
          hostShareFunded ? 'text-emerald-700' : groupClosed ? 'text-amber-800' : 'text-muted'
        }`}
      >
        {hostShareFunded
          ? 'Your host share is funded.'
          : groupClosed
            ? 'Pending your payment on your host escrow leg.'
            : 'Close the group when you are ready to lock in your share and pay.'}
      </p>

      {hostEscrowHref && !hostShareFunded && hostShareCents > 0 ? (
        <Link
          href={hostEscrowHref}
          className="inline-flex w-full items-center justify-center rounded-full linkup-gradient-primary px-6 py-3 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"
        >
          Pay your host share · {fmt(hostCheckoutCents)}
        </Link>
      ) : null}
    </section>
  );
}
