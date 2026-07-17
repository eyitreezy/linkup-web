'use client';

import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoArrowBack } from 'react-icons/io5';

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** When set, back is a button (e.g. close an inline sub-step) instead of navigation. */
  onBackClick?: () => void;
  right?: React.ReactNode;
  className?: string;
};

export function PlanFlowHeader({
  kicker = 'Plan',
  title,
  subtitle,
  backHref = '/discover',
  backLabel = 'Back',
  onBackClick,
  right,
  className,
}: Props) {
  const backClassName =
    'flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 text-foreground shadow-sm transition hover:bg-[#EDE8FF]/60';

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBackClick ? (
          <button type="button" onClick={onBackClick} className={backClassName} aria-label={backLabel}>
            <IoArrowBack size={22} />
          </button>
        ) : (
          <Link href={backHref} className={backClassName} aria-label={backLabel}>
            <IoArrowBack size={22} />
          </Link>
        )}
        {right}
      </div>
      <header className="flex gap-4">
        <div className="mt-1 h-12 w-1 shrink-0 rounded-full linkup-gradient-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">{kicker}</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-[14px] font-semibold leading-relaxed text-muted">{subtitle}</p>
          ) : null}
        </div>
      </header>
    </div>
  );
}
