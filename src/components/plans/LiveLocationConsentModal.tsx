'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  onConsented: () => void;
  onDeclined: () => void;
};

export function LiveLocationConsentModal({ onConsented, onDeclined }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConsent() {
    setBusy(true);
    setError(null);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      setError('Sign in to share your location.');
      setBusy(false);
      return;
    }
    const { error: insertError } = await client
      .from('live_location_consents')
      .insert({ user_id: user.id });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onConsented();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="linkup-card w-full max-w-md space-y-4 p-6 shadow-xl">
        <h2 className="font-display text-xl font-extrabold text-foreground">Share your live location</h2>
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          Live location sharing shows your real-time position to your meetup partner on a map inside the
          plan chat. Your location is only visible to them for the duration you choose.
        </p>
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          Your location data is not stored by LinkUp after the sharing session ends. It is not accessible
          to the dispute team or admin unless you choose to submit a screenshot as evidence. You can
          withdraw this consent at any time from Settings.
        </p>
        <p className="text-[14px] font-extrabold text-foreground">
          By continuing, you consent to LinkUp processing your real-time location under the Nigeria Data
          Protection Regulation (NDPR).
        </p>
        {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
        <button
          type="button"
          onClick={() => void handleConsent()}
          disabled={busy}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white disabled:opacity-50'
          )}
        >
          {busy ? 'Saving…' : 'I consent, share my location'}
        </button>
        <button
          type="button"
          onClick={onDeclined}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-5 text-[14px] font-extrabold text-muted"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
