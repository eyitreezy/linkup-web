'use client';

import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';
import { IoClose, IoNavigateOutline } from 'react-icons/io5';

export const LOCATION_PROMPT_DISMISSED_KEY = 'linkup_location_prompt_dismissed';

function readDismissedFromStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(LOCATION_PROMPT_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      localStorage.setItem(LOCATION_PROMPT_DISMISSED_KEY, 'true');
    } else {
      localStorage.removeItem(LOCATION_PROMPT_DISMISSED_KEY);
    }
  } catch {
    /* ignore */
  }
}

type Props = {
  onRequestLocation: () => void;
  /** Browser/device coordinates are available — hide prompt (matches mobile perm granted). */
  hasDeviceLocation?: boolean;
  className?: string;
};

export function DiscoverLocationPrompt({
  onRequestLocation,
  hasDeviceLocation = false,
  className,
}: Props) {
  const [dismissed, setDismissed] = useState(readDismissedFromStorage);

  useEffect(() => {
    if (hasDeviceLocation) {
      setDismissed(true);
    }
  }, [hasDeviceLocation]);

  if (dismissed || hasDeviceLocation) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-primary/15 bg-white/95 px-4 py-3 shadow-sm',
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <IoNavigateOutline size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold text-foreground">Sort plans by distance</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              persistDismissed(true);
              setDismissed(true);
              onRequestLocation();
            }}
            className="rounded-full linkup-gradient-primary px-4 py-2 text-[13px] font-extrabold text-white shadow-sm"
          >
            Allow location
          </button>
          <button
            type="button"
            onClick={() => {
              persistDismissed(true);
              setDismissed(true);
            }}
            className="rounded-full border border-border px-4 py-2 text-[13px] font-extrabold text-muted"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          persistDismissed(true);
          setDismissed(true);
        }}
        className="shrink-0 rounded-full p-1 text-muted hover:bg-[#F5F6FA]"
        aria-label="Dismiss"
      >
        <IoClose size={18} />
      </button>
    </div>
  );
}
