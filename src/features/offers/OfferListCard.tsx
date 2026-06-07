'use client';

import {
  getOfferDisplayStatus,
  type OfferDashboardRow,
  type OfferDisplayStatus,
} from '@/services/offers.service';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoCheckmarkCircle, IoChevronForward } from 'react-icons/io5';

function statusStyle(s: OfferDisplayStatus) {
  switch (s) {
    case 'accepted':
      return 'bg-[#10B981]/12 text-[#059669] border-[#10B981]/35';
    case 'rejected':
      return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30';
    case 'expired':
      return 'bg-[#F3F4F6] text-muted border-border';
    default:
      return 'bg-primary/12 text-primary border-primary/30';
  }
}

function statusLabel(s: OfferDisplayStatus) {
  switch (s) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Declined';
    case 'expired':
      return 'Expired';
  }
}

type Props = {
  row: OfferDashboardRow;
  mode: 'sent' | 'received';
  busy?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
};

export function OfferListCard({ row, mode, busy, onAccept, onReject }: Props) {
  const { offer, plan, otherName, otherAvatarUrl, otherVerified } = row;
  const display = getOfferDisplayStatus(offer);
  const ts = new Date(offer.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const amount =
    offer.amount_cents != null
      ? `₦${(offer.amount_cents / 100).toLocaleString()}`
      : 'Open amount';
  const canActHost = mode === 'received' && display === 'pending' && !!onAccept && !!onReject;
  const initial = otherName.charAt(0).toUpperCase();

  return (
    <article className="linkup-card relative overflow-hidden">
      <div
        className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-[#34D399]"
        aria-hidden
      />
      <div className="p-3 pt-4 min-[360px]:p-4 min-[360px]:pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase min-[360px]:px-2.5 min-[360px]:text-[11px]', statusStyle(display))}>
            {statusLabel(display)}
          </span>
          <span className="text-[11px] font-bold tabular-nums text-muted min-[360px]:text-[12px]">{ts}</span>
        </div>

        <Link href={`/plan/${plan.id}`} className="block transition hover:opacity-95">
          <h3 className="font-display text-base font-extrabold leading-snug text-foreground line-clamp-2 min-[360px]:text-lg">
            {plan.title}
          </h3>
          <p className="mt-2 text-[20px] font-extrabold tracking-tight text-primary min-[360px]:text-[22px]">{amount}</p>
          {offer.message ? (
            <p className="mt-2 line-clamp-2 text-[14px] font-medium text-muted">{offer.message}</p>
          ) : null}
        </Link>

        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          {otherAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={otherAvatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EDE8FF] text-[15px] font-extrabold text-primary">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-[14px] font-extrabold text-foreground">
              {mode === 'sent' ? 'Host' : 'Guest'}: {otherName}
              {otherVerified ? (
                <IoCheckmarkCircle className="shrink-0 text-primary" size={16} aria-label="Verified" />
              ) : null}
            </p>
            <p className="truncate text-[12px] font-semibold text-muted">
              {plan.location_label ?? 'Location TBC'}
            </p>
          </div>
          <Link
            href={`/plan/${plan.id}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE8FF]/80 text-primary"
            aria-label="Open plan"
          >
            <IoChevronForward size={18} />
          </Link>
        </div>

        {canActHost ? (
          <div className="mt-4 flex flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              className="min-h-[44px] flex-1 rounded-full linkup-gradient-primary px-4 py-2.5 text-[13px] font-extrabold text-white shadow-md disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="min-h-[44px] rounded-full border border-border bg-surface px-4 py-2.5 text-[13px] font-extrabold text-foreground disabled:opacity-50 min-[400px]:flex-1"
            >
              Decline
            </button>
            <Link
              href={`/plan/${plan.id}`}
              className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-primary/25 bg-[#EDE8FF]/50 py-2.5 text-center text-[13px] font-extrabold text-primary"
            >
              Counter / negotiate
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
