'use client';

import { useWebPush } from '@/hooks/useWebPush';
import { useState } from 'react';

export function MoodPlanPushPrompt() {
  const { status, subscribe } = useWebPush();
  const [dismissed, setDismissed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  if (status !== 'default' || dismissed) return null;

  async function handleEnable() {
    setSubscribing(true);
    await subscribe();
    setSubscribing(false);
  }

  return (
    <div className="mx-auto mb-3 w-full max-w-2xl">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-[#EDE8FF]/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg" aria-hidden>
            ⚡
          </span>
          <p className="text-[12px] font-semibold text-primary/80">
            Get notified when mood plans drop near you
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={subscribing}
            className="rounded-full border border-primary/20 bg-white px-3 py-1.5 text-[11px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/60 disabled:opacity-50"
          >
            {subscribing ? 'Enabling...' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[11px] font-semibold text-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
