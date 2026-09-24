'use client';

import { LINKUP_TAB_PAGE_SHELL_CLASS } from '@/lib/layout/mainContent';
import { MATCHMAKER_THEME, matchmakerScreenClass } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

/**
 * MatchMaker route wrapper — shares AppShell padding with Discover; warm fill comes from AppShell `warmMain`.
 */
export function MatchMakerLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        matchmakerScreenClass(),
        'w-full min-h-full',
        'max-lg:pb-[var(--linkup-bottom-nav-offset)] max-lg:-mb-[var(--linkup-bottom-nav-offset)]'
      )}
      style={{ color: MATCHMAKER_THEME.textPrimary }}
    >
      {children}
    </div>
  );
}

/** Inner page column — same width and vertical rhythm as Discover. */
export function MatchMakerPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(LINKUP_TAB_PAGE_SHELL_CLASS, className)}>{children}</div>;
}

export function MatchMakerCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${className}`}
      style={{ background: MATCHMAKER_THEME.surface, borderColor: MATCHMAKER_THEME.border }}
    >
      {children}
    </div>
  );
}

export function MatchMakerPrimaryButton({
  children,
  disabled,
  onClick,
  className = '',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full min-h-[48px] rounded-full font-extrabold text-white shadow-md transition disabled:opacity-50 ${className}`}
      style={{ background: disabled ? MATCHMAKER_THEME.disabled : MATCHMAKER_THEME.ctaGradient }}
    >
      {children}
    </button>
  );
}

export function MatchMakerSecondaryButton({
  children,
  disabled,
  onClick,
  className = '',
  variant = 'filled',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** `filled` — white pill (pool cards). `text` — text-only (profile action row). */
  variant?: 'filled' | 'text';
}) {
  if (variant === 'text') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`min-h-[48px] px-2 text-[15px] font-extrabold transition hover:opacity-80 disabled:opacity-50 ${className}`}
        style={{ color: MATCHMAKER_THEME.textMuted }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full min-h-[48px] rounded-full border bg-white font-extrabold shadow-sm transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50 ${className}`}
      style={{ borderColor: MATCHMAKER_THEME.disabled, color: MATCHMAKER_THEME.textMuted }}
    >
      {children}
    </button>
  );
}
