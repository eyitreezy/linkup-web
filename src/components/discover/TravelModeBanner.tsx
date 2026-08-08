'use client';

import { IoAirplane } from 'react-icons/io5';

interface TravelModeBannerProps {
  cityLabel: string;
  isStale?: boolean;
  onTurnOff: () => void;
}

export function TravelModeBanner({ cityLabel, isStale, onTurnOff }: TravelModeBannerProps) {
  return (
    <div className="mb-3 w-full rounded-2xl border border-primary/15 bg-[#EDE8FF]/40 px-4 py-3">
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm">
            <IoAirplane size={18} className="text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-foreground">
              Travel mode · {cityLabel}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-muted">
              Plans and distances use {cityLabel}, not your home city.
            </p>
            {isStale ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-800">
                This pin is over a week old. Update it or turn travel mode off.
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onTurnOff}
          className="min-h-[40px] shrink-0 rounded-full border border-primary/20 bg-white px-4 py-2 text-[12px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/60 min-[480px]:self-center"
        >
          Turn off travel mode
        </button>
      </div>
    </div>
  );
}
