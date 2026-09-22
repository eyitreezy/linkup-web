'use client';

import {
  LINKUP_MAIN_CONTENT_GUTTER_BLEED_CLASS,
  LINKUP_MAIN_CONTENT_GUTTER_CLASS,
  LINKUP_TAB_PAGE_SHELL_CLASS,
} from '@/lib/layout/mainContent';
import { MATCHMAKER_THEME, matchmakerScreenClass } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export function MatchMakerLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        matchmakerScreenClass(),
        'w-full min-h-full',
        LINKUP_MAIN_CONTENT_GUTTER_BLEED_CLASS,
        LINKUP_MAIN_CONTENT_GUTTER_CLASS,
        // Extend warm background through main's mobile bottom-nav clearance band.
        'max-lg:pb-[var(--linkup-bottom-nav-offset)] max-lg:-mb-[var(--linkup-bottom-nav-offset)]'
      )}
      style={{ color: MATCHMAKER_THEME.textPrimary, backgroundColor: MATCHMAKER_THEME.background }}
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
