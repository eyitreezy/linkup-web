'use client';

import {
  buildGoogleMapsExternalUrl,
  buildGoogleStaticMapUrl,
  buildOpenStreetMapEmbedUrl,
} from '@/lib/maps/staticMapUrl';
import {
  GOOGLE_MAPS_DEV_REFERRER,
  isGoogleMapsConfigured,
} from '@/lib/maps/config';
import { useMemo, useState } from 'react';
import { IoOpenOutline } from 'react-icons/io5';

type Props = {
  latitude: number;
  longitude: number;
  label?: string | null;
  height?: number;
  className?: string;
  zoom?: number;
};

/**
 * Plan location map — static Google image or OSM embed.
 * Avoids @react-google-maps/api JS loader, which often throws console "Failed to fetch"
 * when referrers are misconfigured or the Maps JavaScript API is disabled.
 */
export function LinkUpMap({ latitude, longitude, label, height = 220, className, zoom = 15 }: Props) {
  const [staticFailed, setStaticFailed] = useState(false);

  const staticMapUrl = useMemo(
    () =>
      staticFailed ? null : buildGoogleStaticMapUrl(latitude, longitude, { height: Math.min(height, 320), zoom }),
    [latitude, longitude, height, zoom, staticFailed]
  );
  const osmEmbedUrl = useMemo(
    () => buildOpenStreetMapEmbedUrl(latitude, longitude),
    [latitude, longitude]
  );
  const externalMapsUrl = useMemo(
    () => buildGoogleMapsExternalUrl(latitude, longitude, label),
    [latitude, longitude, label]
  );
  const mapHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={className}>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-[#EDE8FF]/30"
        style={{ height: mapHeight }}
      >
        {staticMapUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staticMapUrl}
            alt={label ? `Map showing ${label}` : 'Meetup location map'}
            className="h-full w-full object-cover"
            onError={() => setStaticFailed(true)}
          />
        ) : (
          <iframe
            title={label ? `Map of ${label}` : 'Meetup location'}
            src={osmEmbedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {staticFailed && isGoogleMapsConfigured() ? (
        <p className="mt-2 text-[11px] font-semibold leading-snug text-amber-800">
          Static map preview unavailable. In Google Cloud Console, enable <strong>Maps Static API</strong> for
          your key and add referrer <code className="text-[10px]">{GOOGLE_MAPS_DEV_REFERRER}</code>.
        </p>
      ) : null}

      {!isGoogleMapsConfigured() ? (
        <p className="mt-2 text-[12px] font-semibold text-muted">
          Add <code className="text-primary">NEXT_PUBLIC_GOOGLE_MAPS_WEB_API_KEY</code> in{' '}
          <code className="text-primary">.env.local</code> for Google map previews (same key as mobile).
        </p>
      ) : null}

      <a
        href={externalMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-primary hover:underline"
      >
        <IoOpenOutline size={14} />
        Open in Google Maps
      </a>
    </div>
  );
}
