'use client';

import { LinkUpMap } from '@/components/maps/LinkUpMap';
import { geocodeLocationLabel } from '@/lib/location/geocode';
import { hasValidMapCoordinates } from '@/lib/maps/coordinates';
import { buildGoogleMapsSearchUrl } from '@/lib/maps/staticMapUrl';
import { useEffect, useState } from 'react';
import { IoLocationOutline, IoOpenOutline } from 'react-icons/io5';

type Props = {
  latitude: number | null;
  longitude: number | null;
  locationLabel?: string | null;
};

type ResolvedCoords = { latitude: number; longitude: number };
type MapStatus = 'idle' | 'loading' | 'ready' | 'unresolved';

export function PlanLocationMap({ latitude, longitude, locationLabel }: Props) {
  const [resolved, setResolved] = useState<ResolvedCoords | null>(() =>
    hasValidMapCoordinates(latitude, longitude) ? { latitude: latitude!, longitude: longitude! } : null
  );
  const [status, setStatus] = useState<MapStatus>(() => {
    if (hasValidMapCoordinates(latitude, longitude)) return 'ready';
    if (locationLabel?.trim()) return 'loading';
    return 'unresolved';
  });

  useEffect(() => {
    if (hasValidMapCoordinates(latitude, longitude)) {
      setResolved({ latitude: latitude!, longitude: longitude! });
      setStatus('ready');
      return;
    }

    const label = locationLabel?.trim();
    if (!label) {
      setResolved(null);
      setStatus('unresolved');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    void (async () => {
      try {
        const coords = await geocodeLocationLabel(label);
        if (cancelled) return;
        if (coords) {
          setResolved(coords);
          setStatus('ready');
        } else {
          setResolved(null);
          setStatus('unresolved');
        }
      } catch {
        if (!cancelled) {
          setResolved(null);
          setStatus('unresolved');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, locationLabel]);

  const label = locationLabel?.trim() || 'Meetup location';

  if (status === 'loading') {
    return (
      <section className="linkup-card overflow-hidden p-4">
        <p className="flex items-start gap-2 text-[13px] font-bold text-foreground">
          <IoLocationOutline className="mt-0.5 shrink-0 text-primary" size={18} />
          <span>{label}</span>
        </p>
        <div className="mt-3 h-[220px] animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <p className="mt-2 text-center text-[12px] font-semibold text-muted">Finding this place on the map…</p>
      </section>
    );
  }

  if (status === 'ready' && resolved) {
    return (
      <section className="linkup-card overflow-hidden p-4">
        <p className="flex items-start gap-2 px-1 pb-3 text-[13px] font-bold text-foreground">
          <IoLocationOutline className="mt-0.5 shrink-0 text-primary" size={18} />
          <span>{label}</span>
        </p>
        <LinkUpMap
          latitude={resolved.latitude}
          longitude={resolved.longitude}
          label={locationLabel}
          height={220}
        />
      </section>
    );
  }

  return (
    <section className="linkup-card p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <IoLocationOutline size={28} />
      </div>
      <p className="mt-4 font-extrabold text-foreground">{label}</p>
      <p className="mt-2 text-[14px] font-semibold text-muted">
        We couldn&apos;t plot this address on a map yet. Open it in Google Maps or edit the plan location with
        search so coordinates are saved.
      </p>
      {label.length > 3 ? (
        <a
          href={buildGoogleMapsSearchUrl(label)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm"
        >
          <IoOpenOutline size={16} />
          Open in Google Maps
        </a>
      ) : null}
    </section>
  );
}
