/**
 * Browser Places Autocomplete — works with HTTP-referrer–restricted API keys.
 * Server-side Places web service calls fail with those keys (no Referer header).
 */
import type { LocationSuggestion } from '@/lib/location/types';
import { AFRICA_COUNTRY_CODES_LOWER } from '@/lib/location/africaCountries';
import { getGoogleMapsWebApiKey } from '@/lib/maps/config';
import { withTimeout } from '@/lib/async/withTimeout';

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

  if (loadPromise) {
    return withTimeout(loadPromise, 4000, null);
  }

  loadPromise = new Promise((resolve) => {
    const scriptId = 'linkup-google-places-js';
    const prior = document.getElementById(scriptId) as HTMLScriptElement | null;

    const finish = (value: typeof google | null) => {
      resolve(value);
    };

    const onReady = () => finish(getGoogleGlobal() ?? null);

    if (prior) {
      if (getGoogleGlobal()?.maps?.places) {
        onReady();
        return;
      }
      prior.addEventListener('load', onReady, { once: true });
      prior.addEventListener('error', () => finish(null), { once: true });
      setTimeout(() => finish(getGoogleGlobal()?.maps?.places ? getGoogleGlobal()! : null), 4000);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => finish(null);
    document.head.appendChild(script);
    setTimeout(() => finish(getGoogleGlobal()?.maps?.places ? getGoogleGlobal()! : null), 4000);
  });

  return withTimeout(loadPromise, 4000, null);
}

export async function clientPlacePredictions(
  input: string,
  limit: number
): Promise<LocationSuggestion[]> {
  const g = await loadGooglePlacesLibrary();
  if (!g?.maps?.places) return [];

  const service = new g.maps.places.AutocompleteService();

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), 3000);
    service.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: AFRICA_COUNTRY_CODES_LOWER.slice(0, 5) },
        location: new g.maps.LatLng(6.5244, 3.3792),
        radius: 8_000_000,
      },
      (predictions, status) => {
        clearTimeout(timer);
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
      }
    );
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
