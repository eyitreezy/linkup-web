/** Google Maps Platform — browser key (referrer-restricted; use with Maps JS API in the client). */
export function getGoogleMapsWebApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_WEB_API_KEY?.trim() ?? '';
}

/** Optional server key for API routes — no HTTP referrer restriction. */
export function getGoogleMapsServerApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ??
    process.env.GOOGLE_MAPS_WEB_API_KEY?.trim() ??
    ''
  );
}

export const isGoogleMapsConfigured = () => Boolean(getGoogleMapsWebApiKey());

/** Dev origin that must be listed on the browser key’s HTTP referrer allowlist. */
export const GOOGLE_MAPS_DEV_REFERRER = 'http://localhost:3000/*';
