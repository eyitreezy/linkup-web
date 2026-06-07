'use client';

import {
  APP_NAME,
  APP_TAGLINE,
  APP_TAGLINE_SECONDARY,
} from '@/lib/brand';
import { IoPeople } from 'react-icons/io5';

function SplashDot({ delayMs }: { delayMs: number }) {
  return (
    <span
      className="splash-dot h-[7px] w-[7px] rounded-full bg-white/90"
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden
    />
  );
}

/** Branded cold-start splash — logo mark, wordmark, and product tagline (mirrors mobile). */
export function AppSplashScreen() {
  return (
    <div
      className="relative flex h-full min-h-[100dvh] w-full flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #2D1B4E 0%, #4A3F9F 28%, #6C63FF 55%, #8B5CF6 78%, #FF6584 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-[280px] w-[280px] rounded-full bg-white/[0.08]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-[70px] bottom-28 h-[220px] w-[220px] rounded-full bg-white/[0.08]"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 pb-24 pt-16">
        <div className="splash-rise mb-7" style={{ animationDelay: '0ms' }}>
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full p-[3px]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06))',
            }}
          >
            <div
              className="flex h-full w-full items-center justify-center rounded-full shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
              style={{
                background: 'linear-gradient(135deg, #6C63FF 0%, #8B7CE8 50%, #FF6584 100%)',
              }}
            >
              <IoPeople size={42} className="text-white" aria-hidden />
            </div>
          </div>
        </div>

        <div className="splash-rise flex flex-col items-center" style={{ animationDelay: '120ms' }}>
          <h1 className="font-display text-[2.875rem] font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
            {APP_NAME}
          </h1>
          <span className="mt-3 h-1 w-14 rounded-full bg-white/55" aria-hidden />
        </div>

        <div
          className="splash-rise mt-5 max-w-[300px] text-center"
          style={{ animationDelay: '260ms' }}
        >
          <p className="text-[18px] font-bold leading-snug tracking-tight text-white/[0.96]">
            {APP_TAGLINE}
          </p>
          <p className="mt-1.5 text-[16px] font-medium leading-relaxed tracking-tight text-white/[0.82]">
            {APP_TAGLINE_SECONDARY}
          </p>
        </div>
      </div>

      <div
        className="splash-fade-in absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 pb-10"
        style={{ animationDelay: '420ms' }}
        aria-hidden
      >
        <SplashDot delayMs={0} />
        <SplashDot delayMs={180} />
        <SplashDot delayMs={360} />
      </div>
    </div>
  );
}
