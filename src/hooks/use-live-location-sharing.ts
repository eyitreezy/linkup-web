'use client';

import { LiveLocationConsentModal } from '@/components/plans/LiveLocationConsentModal';
import {
  pingLiveLocation,
  startLiveLocation,
  stopLiveLocation,
} from '@/lib/groupPlan/liveLocation';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLiveLocationSharing(planId: string | null, currentUserId: string | null) {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!planId || !currentUserId) return;
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

  const startPinging = useCallback((sessionId: string) => {
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
  }, []);

  const handleStartSharing = useCallback(
    async (durationMinutes: number) => {
      if (!planId) return;
      setBusy(true);
      setShowPicker(false);
      const result = await startLiveLocation(planId, durationMinutes);
      setBusy(false);
      if (result.error || !result.session_id) return;
      setActiveSession({ id: result.session_id, expiresAt: result.expires_at ?? '' });
      startPinging(result.session_id);
    },
    [planId, startPinging]
  );

  const handleStopSharing = useCallback(async () => {
    if (!activeSession) return;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    setBusy(true);
    await stopLiveLocation(activeSession.id);
    setActiveSession(null);
    setBusy(false);
  }, [activeSession]);

  const onLiveLocation = useCallback(() => {
    if (hasConsent === null || busy) return;
    if (!hasConsent) {
      setShowConsent(true);
      return;
    }
    if (activeSession) {
      void handleStopSharing();
      return;
    }
    setShowPicker(true);
  }, [hasConsent, busy, activeSession, handleStopSharing]);

  const enabled = !!planId && !!currentUserId;

  return {
    enabled,
    onLiveLocation,
    liveLocationActive: !!activeSession,
    liveLocationBusy: busy || hasConsent === null,
    showConsent,
    setShowConsent,
    showPicker,
    setShowPicker,
    setHasConsent,
    handleStartSharing,
  };
}
