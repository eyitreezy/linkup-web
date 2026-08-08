'use client';

import { SplashBackground } from '@/components/splash/SplashBackground';
import { SplashBrandLockup } from '@/components/splash/SplashBrandLockup';
import { FLOWDECK_ATTRIBUTION } from '@/lib/brand';

/** Branded cold-start splash — pastel backdrop + linkup lockup (mirrors end-result mock). */
export function AppSplashScreen() {
  return (
    <SplashBackground>
      <div className="relative z-10 flex h-full flex-1 flex-col items-center justify-center px-8 pb-24 pt-16">
        <div className="splash-rise" style={{ animationDelay: '0ms' }}>
          <SplashBrandLockup lockupWidth={320} />
        </div>
        <p className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 text-center text-[11px] font-semibold tracking-wide text-[#DC2626]">
          {FLOWDECK_ATTRIBUTION}
        </p>
      </div>
    </SplashBackground>
  );
}
