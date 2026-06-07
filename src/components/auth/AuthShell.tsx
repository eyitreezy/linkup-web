'use client';

import '@/components/auth/auth-mobile.css';
import { AuthGlassCard } from '@/components/auth/AuthGlassCard';
import { AuthHeroSlider } from '@/components/auth/AuthHeroSlider';
import { AuthMobileHeroBackdrop, AuthMobileHeroCopy } from '@/components/auth/AuthMobileHero';
import { AuthMobileHeroProvider } from '@/components/auth/AuthMobileHeroContext';
import { AuthModeToggle } from '@/components/auth/AuthModeToggle';
import type { ReactNode } from 'react';

type Variant = 'default' | 'recovery';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
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
  showHero = true,
  showModeToggle = false,
  variant = 'default',
}: Props) {
  const isRecovery = variant === 'recovery';
  const showMobileHero = showHero && !isRecovery;

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
          {showModeToggle ? <AuthModeToggle /> : null}
          {children}
        </AuthGlassCard>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <AuthHeroSlider />

      {/* Mobile / tablet ≤1023px */}
      {showMobileHero ? (
        <AuthMobileHeroProvider>{mobileColumn}</AuthMobileHeroProvider>
      ) : (
        mobileColumn
      )}

      {/* Desktop ≥1024px */}
      <div className="hidden min-h-screen flex-1 flex-col items-center justify-center bg-[#F5F6FA] px-6 py-12 lg:flex">
        <div className="linkup-card w-full max-w-md rounded-3xl border border-primary/10 p-8 shadow-[var(--shadow-card)] xl:p-10">
          <div className="mb-8 text-left">
            <p className="font-display text-2xl font-extrabold tracking-tight text-primary">LinkUp</p>
            {title ? (
              <h1 className="font-display mt-2 text-[26px] font-extrabold leading-snug text-foreground">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">{subtitle}</p>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
