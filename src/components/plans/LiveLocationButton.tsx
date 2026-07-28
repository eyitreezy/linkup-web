'use client';

import { LiveLocationConsentModal } from '@/components/plans/LiveLocationConsentModal';
import {
  pingLiveLocation,
  startLiveLocation,
  stopLiveLocation,
} from '@/lib/groupPlan/liveLocation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { IoLocation, IoLocationOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  currentUserId: string;
};

export function LiveLocationButton({ planId, currentUserId }: Props) {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const client = createClient();
    void client
      .from('live_location_consents')
      .select('id')
      .eq('user_id', currentUserId)
      .maybeSingle()
      .then(({ data }) => setHasConsent(!!data));

    void client
      .from('live_location_sessions')
      .select('id, expires_at')
      .eq('plan_id', planId)
      .eq('sharer_id', currentUserId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setActiveSession({ id: data.id, expiresAt: data.expires_at });
      });
  }, [planId, currentUserId]);

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  function startPinging(sessionId: string) {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void pingLiveLocation({
            session_id: sessionId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }, 8000);
  }

  async function handleStartSharing(durationMinutes: number) {
    setBusy(true);
    setShowPicker(false);
    const result = await startLiveLocation(planId, durationMinutes);
    setBusy(false);
    if (result.error || !result.session_id) return;
    setActiveSession({ id: result.session_id, expiresAt: result.expires_at ?? '' });
    startPinging(result.session_id);
  }

  async function handleStopSharing() {
    if (!activeSession) return;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    setBusy(true);
    await stopLiveLocation(activeSession.id);
    setActiveSession(null);
    setBusy(false);
  }

  function handleClick() {
    if (hasConsent === null) return;
    if (!hasConsent) {
      setShowConsent(true);
      return;
    }
    if (activeSession) {
      void handleStopSharing();
      return;
    }
    setShowPicker(true);
  }

  if (showConsent) {
    return (
      <LiveLocationConsentModal
        onConsented={() => {
          setHasConsent(true);
          setShowConsent(false);
          setShowPicker(true);
        }}
        onDeclined={() => setShowConsent(false)}
      />
    );
  }

  return (
    <div className="relative px-2.5 pb-2 min-[360px]:px-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-extrabold transition disabled:opacity-50',
          activeSession
            ? 'border-emerald-500/40 bg-emerald-50 text-emerald-800'
            : 'border-border bg-white/90 text-foreground hover:bg-black/5'
        )}
      >
        {activeSession ? <IoLocation size={16} /> : <IoLocationOutline size={16} />}
        {busy ? 'Please wait…' : activeSession ? 'Stop sharing location' : 'Share live location'}
      </button>

      {showPicker ? (
        <div className="absolute bottom-full left-2.5 right-2.5 z-20 mb-1 rounded-xl border border-border bg-white p-2 shadow-lg min-[360px]:left-3 min-[360px]:right-3">
          <p className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Share for how long?
          </p>
          {[
            { label: '15 minutes', value: 15 },
            { label: '1 hour', value: 60 },
            { label: 'Until I stop', value: -1 },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void handleStartSharing(opt.value)}
              className="flex w-full rounded-lg px-3 py-2.5 text-left text-[14px] font-extrabold text-foreground hover:bg-[#F5F6FA]"
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="mt-1 w-full rounded-lg px-3 py-2 text-[13px] font-semibold text-muted"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
