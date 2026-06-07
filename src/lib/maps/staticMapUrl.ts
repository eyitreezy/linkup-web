import { getGoogleMapsWebApiKey } from '@/lib/maps/config';

/** Google Static Maps image URL — works when JS Maps tiles fail or while loading. */
export function buildGoogleStaticMapUrl(
  latitude: number,
  longitude: number,
  opts?: { width?: number; height?: number; zoom?: number }
): string | null {
  const key = getGoogleMapsWebApiKey();
  if (!key) return null;

  const width = opts?.width ?? 640;
  const height = opts?.height ?? 280;
  const zoom = opts?.zoom ?? 15;
  const marker = `color:0x6C63FF%7C${latitude},${longitude}`;

  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    markers: marker,
    key,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export function buildOpenStreetMapEmbedUrl(latitude: number, longitude: number): string {
  const delta = 0.012;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  return (
    `https://www.openstreetmap.org/export/embed.html` +
    `?bbox=${encodeURIComponent(bbox)}` +
    `&layer=mapnik` +
    `&marker=${latitude}%2C${longitude}`
  );
}

export function buildGoogleMapsExternalUrl(
  latitude: number,
  longitude: number,
  label?: string | null
): string {
  const text = label?.trim();
  const query = text
    ? encodeURIComponent(text)
    : encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildGoogleMapsSearchUrl(label: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label.trim())}`;
}
