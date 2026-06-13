'use client';

import { EscrowModalShell } from '@/components/escrow/EscrowModalShell';
import { EscrowNoticeBanner } from '@/components/escrow/EscrowNoticeBanner';
import { TierBadge } from '@/components/subscription/TierBadge';
import Link from 'next/link';
import { IoLockClosed, IoShieldCheckmark, IoWarningOutline } from 'react-icons/io5';

type Props = {
  open: boolean;
  variant?: 'self' | 'counterparty' | 'platinum';
  onClose: () => void;
};

export function HighValueEscrowModal({ open, variant = 'self', onClose }: Props) {
  const title =
    variant === 'platinum'
      ? 'Platinum required'
      : variant === 'counterparty'
        ? 'Guest verification required'
        : 'Advanced verification required';

  const body =
    variant === 'counterparty'
      ? 'Your guest must complete Tier 3 identity verification before this high-value escrow can proceed.'
      : 'Escrow agreements above ₦5,000,000 require Tier 3 identity verification, available exclusively to Platinum members.';

  return (
    <EscrowModalShell open={open} onClose={onClose} maxWidth="sm">
      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          {variant === 'counterparty' ? (
            <IoWarningOutline size={24} />
          ) : (
            <IoLockClosed size={24} />
          )}
        </span>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">High-value escrow</p>
          <h2 className="font-display text-xl font-extrabold text-foreground">{title}</h2>
          <p className="mt-1 text-[14px] font-semibold text-muted">{body}</p>
        </div>
      </div>

      {variant !== 'counterparty' ? (
        <div className="mt-5">
          <EscrowNoticeBanner
            tone="platinum"
            icon={<IoShieldCheckmark className="text-violet-600" size={18} />}
            title="Platinum exclusive"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span>Upgrade and complete Tier 3 verification to unlock agreements above ₦5M.</span>
              <TierBadge tier="PLATINUM" size="sm" />
            </div>
          </EscrowNoticeBanner>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 min-[360px]:flex-row min-[360px]:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted"
        >
          {variant === 'counterparty' ? 'Got it' : 'Cancel'}
        </button>
        {variant !== 'counterparty' ? (
          <Link
            href="/subscription"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white"
          >
            View Platinum plans
          </Link>
        ) : null}
      </div>
    </EscrowModalShell>
  );
}
