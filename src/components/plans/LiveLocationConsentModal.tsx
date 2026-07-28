'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoShareOutline } from 'react-icons/io5';

type Props = {
  onConsented: () => void;
  onDeclined: () => void;
};

export function LiveLocationConsentModal({ onConsented, onDeclined }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-location-consent-title"
    >
      <div className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-5 shadow-xl min-[425px]:p-6">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE8FF]">
            <IoShareOutline size={28} className="text-primary" />
          </div>
        </div>
        <h2
          id="live-location-consent-title"
          className="text-center font-display text-xl font-extrabold text-foreground"
        >
          Share your live location
        </h2>
        <div className="mt-4 max-h-[min(50vh,320px)] space-y-3 overflow-y-auto pr-1">
          <p className="text-[14px] font-semibold leading-relaxed text-muted">
            Live location sharing shows your real-time position to your meetup partner on a map inside
            the plan chat. Your location is only visible to them for the duration you choose.
          </p>
          <p className="text-[14px] font-semibold leading-relaxed text-muted">
            Your location data is not stored by LinkUp after the sharing session ends. It is not
            accessible to the dispute team or admin unless you choose to submit a screenshot as
            evidence. You can withdraw this consent at any time from Settings.
          </p>
          <p className="text-[14px] font-extrabold text-foreground">
            By continuing, you consent to LinkUp processing your real-time location under the Nigeria
            Data Protection Regulation (NDPR).
          </p>
        </div>
        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 min-[425px]:mt-6 min-[425px]:flex-row min-[425px]:flex-wrap min-[425px]:justify-end min-[425px]:gap-3">
          <button
            type="button"
            onClick={onDeclined}
            disabled={busy}
            className="min-h-[44px] w-full rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50 min-[425px]:w-auto min-[425px]:px-5"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void handleConsent()}
            disabled={busy}
            className={cn(
              'min-h-[44px] w-full rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50 min-[425px]:w-auto min-[425px]:px-5'
            )}
          >
            {busy ? 'Saving…' : 'I consent, share my location'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
