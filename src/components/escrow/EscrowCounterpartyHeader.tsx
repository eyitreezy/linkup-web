'use client';

import { cn } from '@/utils/cn';
import { IoCheckmarkCircle, IoInformationCircleOutline, IoShieldCheckmark } from 'react-icons/io5';

export type EscrowParty = {
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

function EscrowAvatar({ uri, name, size = 56 }: { uri: string | null; name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  if (uri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={uri}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initial}
    </span>
  );
}

type Props = {
  title: string;
  counterparty: EscrowParty;
  youLabel: string;
  className?: string;
};

export function EscrowCounterpartyHeader({ title, counterparty, youLabel, className }: Props) {
  return (
    <section
      className={cn(
        'linkup-card relative overflow-hidden p-5 sm:p-6',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[72px] bg-gradient-to-r from-primary/15 via-secondary/5 to-transparent"
        aria-hidden
      />
      <div className="relative">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Plan</p>
        <h2 className="mt-1 font-display text-xl font-extrabold leading-snug tracking-tight text-foreground sm:text-[20px]">
          {title}
        </h2>
        <div className="my-4 h-[3px] rounded-full bg-gradient-to-r from-primary/35 via-secondary/20 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="rounded-full bg-gradient-to-br from-primary to-secondary p-[3px]">
              <div className="rounded-full bg-white p-0.5">
                <EscrowAvatar uri={counterparty.avatarUrl} name={counterparty.name} />
              </div>
            </div>
            {counterparty.verified ? (
              <IoCheckmarkCircle
                size={18}
                className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white text-emerald-600"
                aria-label="Verified"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">With</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-extrabold text-foreground">{counterparty.name}</p>
              {counterparty.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                  <IoShieldCheckmark size={12} />
                  Verified
                </span>
              ) : null}
            </div>
            {youLabel ? (
              <div className="mt-2 flex items-start gap-1.5 border-t border-primary/10 pt-2">
                <IoInformationCircleOutline size={14} className="mt-0.5 shrink-0 text-primary" />
                <p className="text-[13px] font-semibold leading-relaxed text-muted">{youLabel}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
