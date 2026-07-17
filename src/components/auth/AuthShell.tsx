'use client';

import '@/components/auth/auth-mobile.css';
import { AuthGlassCard } from '@/components/auth/AuthGlassCard';
import { AuthHeroSlider } from '@/components/auth/AuthHeroSlider';
import { AuthMobileHeroBackdrop, AuthMobileHeroCopy } from '@/components/auth/AuthMobileHero';
import { AuthMobileHeroProvider } from '@/components/auth/AuthMobileHeroContext';
import { AuthModeToggle } from '@/components/auth/AuthModeToggle';
import { AuthPageHeader } from '@/components/auth/AuthPageHeader';
import type { ReactNode } from 'react';

type Variant = 'default' | 'recovery';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Inline “Join” + wordmark instead of a separate logo and “Join LinkUp” title. */
  headingVariant?: 'join-logo' | 'text';
  /** Full-bleed hero on mobile (login/signup). Off for forgot/reset. */
  showHero?: boolean;
  /** Log in / Sign up pill toggle (login & signup routes). */
  showModeToggle?: boolean;
  variant?: Variant;
};

export function AuthShell({
  children,
  title,
  subtitle,
  headingVariant = 'text',
  showHero = true,
  showModeToggle = false,
  variant = 'default',
}: Props) {
  const isRecovery = variant === 'recovery';
  const showMobileHero = showHero && !isRecovery;
  const showHeader = headingVariant === 'join-logo' || Boolean(title || subtitle);

  const header = showHeader ? (
    <AuthPageHeader headingVariant={headingVariant} title={title} subtitle={subtitle} />
  ) : null;

  const mobileColumn = (
    <div className="auth-mobile-root flex flex-1 flex-col lg:hidden">
      {showMobileHero ? <AuthMobileHeroBackdrop /> : null}
      <div
        className={
          showMobileHero
            ? 'auth-mobile-stage auth-mobile-stage--hero'
            : 'auth-mobile-stage auth-mobile-stage--recovery'
        }
      >
        {showMobileHero ? <AuthMobileHeroCopy /> : null}
        <AuthGlassCard>
          {header}
          {showModeToggle ? <AuthModeToggle /> : null}
          {children}
        </AuthGlassCard>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <AuthHeroSlider />

      {showMobileHero ? (
        <AuthMobileHeroProvider>{mobileColumn}</AuthMobileHeroProvider>
      ) : (
        mobileColumn
      )}

      <div className="hidden min-h-screen flex-1 flex-col items-center justify-center bg-[#F5F6FA] px-6 py-12 lg:flex">
        <div className="linkup-card w-full max-w-md rounded-3xl border border-primary/10 p-8 shadow-[var(--shadow-card)] xl:p-10">
          {header}
          {children}
        </div>
      </div>
    </div>
  );
}
