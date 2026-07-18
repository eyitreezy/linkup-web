'use client';

import { SplashBackground } from '@/components/splash/SplashBackground';
import { SplashBrandLockup } from '@/components/splash/SplashBrandLockup';

/** Branded cold-start splash — pastel backdrop + linkup lockup (mirrors end-result mock). */
export function AppSplashScreen() {
  return (
    <SplashBackground>
      <div className="relative z-10 flex h-full flex-1 flex-col items-center justify-center px-8 pb-24 pt-16">
        <div className="splash-rise" style={{ animationDelay: '0ms' }}>
          <SplashBrandLockup lockupWidth={320} />
        </div>
      </div>
    </SplashBackground>
  );
}
