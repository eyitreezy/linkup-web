'use client';

import { AppSplashScreen } from '@/components/splash/AppSplashScreen';
import { APP_SPLASH_DURATION_MS } from '@/lib/brand';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/utils/cn';
import { useEffect, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/**
 * Cold-start splash overlay — minimum brand display, then hands off to the app.
 * Mirrors mobile SplashGate: minimum brand display + wait for session restore, then fade out.
 */
export function SplashGate({ children }: Props) {
  const { loading: authLoading } = useSession();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinTimeElapsed(true), APP_SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minTimeElapsed || authLoading) return;
    setFading(true);
    const timer = window.setTimeout(() => setOverlayVisible(false), 420);
    return () => window.clearTimeout(timer);
  }, [authLoading, minTimeElapsed]);

  return (
    <>
      {children}
      {overlayVisible ? (
        <div
          className={cn(
            'fixed inset-0 z-[10000] h-[100dvh] w-full transition-opacity duration-[420ms] ease-out',
            fading ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="LinkUp loading"
          aria-busy={!fading}
        >
          <AppSplashScreen />
        </div>
      ) : null}
    </>
  );
}
