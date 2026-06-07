'use client';

import type { ViewerGeoCoords } from '@/lib/discovery/viewerLocation';
import { useEffect, useState } from 'react';

export type { ViewerGeoCoords };

/**
 * Browser GPS pin for discover proximity sort — mirrors mobile `expo-location` coords
 * (device location overrides stored profile lat/lng when available).
 */
export function useViewerGeolocation(enabled: boolean): ViewerGeoCoords | null {
  const [coords, setCoords] = useState<ViewerGeoCoords | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        /* Denied or unavailable — profile pin is used instead. */
      },
      {
        enableHighAccuracy: false,
        maximumAge: 120_000,
        timeout: 12_000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return coords;
}
