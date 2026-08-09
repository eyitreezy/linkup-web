/**
 * Location suggestions for search fields.
 * Order: server API (Nominatim fallback) → browser Google Places (optional, timed).
 */
import { withTimeout } from '@/lib/async/withTimeout';
import {
  NIGERIA_LOCATION_REJECTED_MESSAGE,
  isCoordinateInNigeria,
} from '@/lib/location/nigeriaBounds';
import { safeFetch } from '@/lib/fetch/safeFetch';
import {
  clientPlaceDetails,
  clientPlacePredictions,
} from '@/lib/location/googlePlacesClient';
import type { LocationSuggestion } from '@/lib/location/types';

/** User must type at least this many characters before suggestions run. */
export const LOCATION_SUGGEST_MIN_CHARS = 3;

const CLIENT_GOOGLE_TIMEOUT_MS = 2500;

type AutocompleteResponse = {
  status: string;
  predictions?: {
    description: string;
    place_id: string;
    latitude?: number;
    longitude?: number;
  }[];
};

type PlaceDetailsResponse = {
  status: string;
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
};

async function serverPlacePredictions(
  query: string,
  limit: number
): Promise<LocationSuggestion[]> {
  const res = await safeFetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
  if (!res?.ok) return [];

  let autoJson: AutocompleteResponse;
  try {
    autoJson = (await res.json()) as AutocompleteResponse;
  } catch {
    return [];
  }

  const predictions = autoJson.predictions ?? [];
  if (autoJson.status !== 'OK' || predictions.length === 0) return [];

  return predictions.slice(0, limit).map((p) => ({
    label: p.description,
    latitude: typeof p.latitude === 'number' ? p.latitude : 0,
    longitude: typeof p.longitude === 'number' ? p.longitude : 0,
    placeId: p.place_id,
  }));
}

async function serverPlaceDetails(placeId: string): Promise<LocationSuggestion | null> {
  const res = await safeFetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
  if (!res?.ok) return null;

  let detJson: PlaceDetailsResponse;
  try {
    detJson = (await res.json()) as PlaceDetailsResponse;
  } catch {
    return null;
  }
  const loc = detJson.result?.geometry?.location;
  if (!loc) return null;

  return {
    label: detJson.result?.formatted_address?.trim() || placeId,
    latitude: loc.lat,
    longitude: loc.lng,
    placeId,
  };
}

async function clientPlacePredictionsWithTimeout(
  query: string,
  limit: number
): Promise<LocationSuggestion[]> {
  if (typeof window === 'undefined') return [];
  return withTimeout(clientPlacePredictions(query, limit), CLIENT_GOOGLE_TIMEOUT_MS, []);
}

export async function searchGooglePlaceSuggestions(
  query: string,
  limit = 8
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < LOCATION_SUGGEST_MIN_CHARS) return [];

  const serverRows = await serverPlacePredictions(trimmed, limit);
  if (serverRows.length > 0) return serverRows;

  const clientRows = await clientPlacePredictionsWithTimeout(trimmed, limit);
  return clientRows;
}

export async function resolveGooglePlaceSuggestion(
  suggestion: LocationSuggestion
): Promise<LocationSuggestion> {
  let resolved = suggestion;

  if (suggestion.latitude !== 0 && suggestion.longitude !== 0) {
    resolved = suggestion;
  } else if (suggestion.placeId && !suggestion.placeId.startsWith('osm:')) {
    if (typeof window !== 'undefined') {
      const clientResolved = await withTimeout(
        clientPlaceDetails(suggestion.placeId),
        CLIENT_GOOGLE_TIMEOUT_MS,
        null
      );
      if (clientResolved) resolved = clientResolved;
    }
    if (resolved.latitude === 0 && resolved.longitude === 0) {
      const serverResolved = await serverPlaceDetails(suggestion.placeId);
      if (serverResolved) resolved = serverResolved;
    }
  }

  if (!isCoordinateInNigeria(resolved.latitude, resolved.longitude)) {
    throw new Error(NIGERIA_LOCATION_REJECTED_MESSAGE);
  }

  return resolved;
}
