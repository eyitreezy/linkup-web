'use client';

import { IoAirplane } from 'react-icons/io5';

interface TravelModeBannerProps {
  cityLabel: string;
  isStale?: boolean;
  onTurnOff: () => void;
}

export function TravelModeBanner({ cityLabel, isStale, onTurnOff }: TravelModeBannerProps) {
  return (
    <div className="mx-auto mb-3 w-full max-w-2xl rounded-2xl border border-primary/15 bg-[#EDE8FF]/40 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IoAirplane size={15} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold text-primary">Browsing {cityLabel}</p>
            {isStale ? (
              <p className="text-[11px] font-semibold text-muted">Travel pin set over a week ago</p>
            ) : null}
            <p className="text-[11px] font-semibold text-muted">Distances shown from {cityLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTurnOff}
          className="shrink-0 rounded-full border border-primary/20 bg-white px-3 py-1.5 text-[12px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/60"
        >
          Turn off
        </button>
      </div>
    </div>
  );
}
