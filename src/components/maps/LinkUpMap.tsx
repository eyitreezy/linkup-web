'use client';

import {
  buildGoogleMapsExternalUrl,
  buildOpenStreetMapEmbedUrl,
} from '@/lib/maps/staticMapUrl';
import { useMemo } from 'react';
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
 * Plan location map using OpenStreetMap embed (no API key required).
 * External directions open in Google Maps when the member chooses.
 */
export function LinkUpMap({ latitude, longitude, label, height = 220, className }: Props) {
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
        <iframe
          title={label ? `Map of ${label}` : 'Meetup location'}
          src={osmEmbedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

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
