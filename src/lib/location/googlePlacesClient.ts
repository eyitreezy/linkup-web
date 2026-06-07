/**
 * Browser Places Autocomplete — works with HTTP-referrer–restricted API keys.
 * Server-side Places web service calls fail with those keys (no Referer header).
 */
import type { LocationSuggestion } from '@/lib/location/types';
import { getGoogleMapsWebApiKey } from '@/lib/maps/config';

let loadPromise: Promise<typeof google | null> | null = null;

function getGoogleGlobal(): typeof google | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { google?: typeof google }).google;
}

export function loadGooglePlacesLibrary(): Promise<typeof google | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const key = getGoogleMapsWebApiKey();
  if (!key) return Promise.resolve(null);

  const existing = getGoogleGlobal();
  if (existing?.maps?.places) return Promise.resolve(existing);

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const scriptId = 'linkup-google-places-js';
    const prior = document.getElementById(scriptId) as HTMLScriptElement | null;

    const onReady = () => resolve(getGoogleGlobal() ?? null);

    if (prior) {
      if (getGoogleGlobal()?.maps?.places) {
        onReady();
        return;
      }
      prior.addEventListener('load', onReady, { once: true });
      prior.addEventListener('error', () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function clientPlacePredictions(
  input: string,
  limit: number
): Promise<LocationSuggestion[]> {
  const g = await loadGooglePlacesLibrary();
  if (!g?.maps?.places) return [];

  const service = new g.maps.places.AutocompleteService();

  return new Promise((resolve) => {
    service.getPlacePredictions({ input }, (predictions, status) => {
      if (status !== g.maps.places.PlacesServiceStatus.OK || !predictions?.length) {
        resolve([]);
        return;
      }
      resolve(
        predictions.slice(0, limit).map((p) => ({
          label: p.description,
          placeId: p.place_id,
          latitude: 0,
          longitude: 0,
        }))
      );
    });
  });
}

export async function clientPlaceDetails(placeId: string): Promise<LocationSuggestion | null> {
  const g = await loadGooglePlacesLibrary();
  if (!g?.maps?.places) return null;

  const host = document.createElement('div');
  const service = new g.maps.places.PlacesService(host);

  return new Promise((resolve) => {
    service.getDetails(
      { placeId, fields: ['formatted_address', 'geometry'] },
      (place, status) => {
        const loc = place?.geometry?.location;
        if (status !== g.maps.places.PlacesServiceStatus.OK || !loc) {
          resolve(null);
          return;
        }
        resolve({
          label: place.formatted_address?.trim() || placeId,
          latitude: loc.lat(),
          longitude: loc.lng(),
          placeId,
        });
      }
    );
  });
}
