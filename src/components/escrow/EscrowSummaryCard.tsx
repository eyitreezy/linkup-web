'use client';

import {
  IoCardOutline,
  IoCashOutline,
  IoLocationOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import type { IconType } from 'react-icons';

function SummaryRow({
  icon: Icon,
  label,
  value,
  emphasize = false,
}: {
  icon: IconType;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={20} className={emphasize ? 'mt-0.5 shrink-0 text-primary' : 'mt-0.5 shrink-0 text-muted'} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-muted">{label}</p>
        <p
          className={
            emphasize
              ? 'font-display text-lg font-extrabold text-primary'
              : 'text-[15px] font-semibold leading-snug text-foreground'
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}

type Props = {
  totalHeldLabel: string;
  paymentStatusLabel: string;
  whenLabel: string;
  locationLabel: string;
  trustNote: string;
  yourShareLabel?: string | null;
  className?: string;
};

export function EscrowSummaryCard({
  totalHeldLabel,
  paymentStatusLabel,
  whenLabel,
  locationLabel,
  trustNote,
  yourShareLabel,
  className,
}: Props) {
  return (
    <section className={`linkup-card space-y-4 p-5 sm:p-6 ${className ?? ''}`}>
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Escrow summary</p>
      {yourShareLabel ? (
        <SummaryRow icon={IoWalletOutline} label="Your payment" value={yourShareLabel} emphasize />
      ) : null}
      <SummaryRow
        icon={IoCashOutline}
        label={yourShareLabel ? 'Total held' : 'Amount'}
        value={totalHeldLabel}
        emphasize={!yourShareLabel}
      />
      <SummaryRow icon={IoCardOutline} label="Payment status" value={paymentStatusLabel} />
      <SummaryRow icon={IoTimeOutline} label="When" value={whenLabel} />
      <SummaryRow icon={IoLocationOutline} label="Where" value={locationLabel} />
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
        <IoShieldCheckmarkOutline size={18} className="mt-0.5 shrink-0 text-emerald-700" />
        <p className="text-[14px] font-semibold leading-relaxed text-emerald-900">{trustNote}</p>
      </div>
    </section>
  );
}
