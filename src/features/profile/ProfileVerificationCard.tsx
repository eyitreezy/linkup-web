'use client';

import { friendlyStatus, statusVisual, toUiStatus } from '@/features/trust/verificationUi';
import type { UserVerification } from '@/types/database';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import {
  IoChevronForward,
  IoCloseCircle,
  IoShieldCheckmark,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
} from 'react-icons/io5';

type Props = {
  verificationStatus?: UserVerification;
};

function statusValue(status: ReturnType<typeof toUiStatus>): string {
  if (status === 'verified') return 'On';
  if (status === 'pending') return 'Pending';
  if (status === 'rejected') return 'Retry';
  return 'Off';
}

function statusHint(status: ReturnType<typeof toUiStatus>): string {
  if (status === 'verified') return 'Others see your badge on plans and messages';
  return friendlyStatus(status).sub;
}

export function ProfileVerificationCard({ verificationStatus }: Props) {
  const uiStatus = toUiStatus(verificationStatus);
  const visual = statusVisual(uiStatus);
  const isVerified = uiStatus === 'verified';
  const isPending = uiStatus === 'pending';
  const isRejected = uiStatus === 'rejected';

  const borderClass = isVerified
    ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500'
    : isPending
      ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400'
      : isRejected
        ? 'bg-gradient-to-br from-red-300 via-red-400 to-rose-400'
        : 'linkup-gradient-primary';

  const innerBg = isVerified
    ? 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70'
    : isPending
      ? 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60'
      : isRejected
        ? 'bg-gradient-to-br from-red-50/80 via-white to-rose-50/60'
        : 'bg-gradient-to-br from-white via-[#F8F4FF] to-[#FFF5F8]';

  const iconShell = isVerified
    ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
    : isPending
      ? 'bg-gradient-to-br from-amber-500 to-orange-500'
      : isRejected
        ? 'bg-gradient-to-br from-red-500 to-rose-600'
        : 'linkup-gradient-primary';

  const StatusIcon = isVerified
    ? IoShieldCheckmark
    : isPending
      ? IoTimeOutline
      : isRejected
        ? IoCloseCircle
        : IoShieldCheckmarkOutline;

  const ctaLabel = isVerified ? 'Trust center' : isPending ? 'View status' : 'Get verified';

  return (
    <Link
      href="/trust"
      className={cn(
        'group block touch-manipulation overflow-hidden rounded-[22px] p-[2px] shadow-[0_10px_32px_rgba(108,99,255,0.14)] transition hover:shadow-[0_14px_40px_rgba(108,99,255,0.2)] active:scale-[0.99]',
        borderClass
      )}
    >
      <div className={cn('relative overflow-hidden rounded-[20px] p-4 min-[400px]:p-5', innerBg)}>
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/8"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-5 left-1/3 h-16 w-16 rounded-full bg-secondary/8"
          aria-hidden
        />

        <div className="relative flex items-center gap-3 min-[400px]:gap-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md min-[400px]:h-[52px] min-[400px]:w-[52px]',
              iconShell
            )}
          >
            <StatusIcon size={26} aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                Verification
              </span>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-extrabold capitalize',
                  visual.pill
                )}
              >
                {verificationStatus ?? 'unverified'}
              </span>
            </div>
            <p
              className={cn(
                'font-display mt-0.5 text-2xl font-extrabold tracking-tight min-[400px]:text-3xl',
                isVerified ? 'text-emerald-700' : isPending ? 'text-amber-800' : 'text-foreground'
              )}
            >
              {statusValue(uiStatus)}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-muted min-[400px]:text-[13px]">
              {statusHint(uiStatus)}
            </p>
          </div>

          <span
            className={cn(
              'hidden shrink-0 items-center gap-1 rounded-full px-4 py-2 text-[12px] font-extrabold text-white shadow-sm transition group-hover:opacity-95 min-[480px]:inline-flex',
              iconShell
            )}
          >
            {ctaLabel}
            <IoChevronForward size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
          </span>
          <IoChevronForward
            size={20}
            className="shrink-0 text-muted transition group-hover:translate-x-0.5 min-[480px]:hidden"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}
