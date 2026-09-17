'use client';

import { MATCHMAKER_THEME, matchmakerScreenClass } from '@/lib/matchmaker/theme';
import type { ReactNode } from 'react';

export function MatchMakerLayout({ children }: { children: ReactNode }) {
  return (
    <div className={matchmakerScreenClass()} style={{ color: MATCHMAKER_THEME.textPrimary }}>
      {children}
    </div>
  );
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
