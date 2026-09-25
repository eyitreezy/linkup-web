'use client';

import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { IoArrowBack } from 'react-icons/io5';

type Props = {
  kicker: string;
  title: string;
  subtitle: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
};

/** Edit-profile-style page header with MatchMaker warm tokens. */
export function MatchMakerPageHeader({
  kicker,
  title,
  subtitle,
  backLabel = 'Back',
  onBack,
  actions,
  className,
}: Props) {
  const router = useRouter();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/90 shadow-sm transition hover:opacity-95 active:scale-[0.98]"
          style={{ borderColor: `${MATCHMAKER_THEME.accent}33`, color: MATCHMAKER_THEME.textPrimary }}
          aria-label={backLabel}
        >
          <IoArrowBack size={22} />
        </button>
        {actions}
      </div>
      <header className="flex gap-4">
        <div
          className="mt-2 h-14 w-1 shrink-0 rounded-full"
          style={{ background: `linear-gradient(180deg, ${MATCHMAKER_THEME.accent} 0%, ${MATCHMAKER_THEME.primary} 100%)` }}
          aria-hidden
        />
        <div>
          <p
            className="text-[11px] font-extrabold uppercase tracking-wide"
            style={{ color: MATCHMAKER_THEME.accent }}
          >
            {kicker}
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight" style={{ color: MATCHMAKER_THEME.textPrimary }}>
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
            {subtitle}
          </p>
        </div>
      </header>
    </div>
  );
}
