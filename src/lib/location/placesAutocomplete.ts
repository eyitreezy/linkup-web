/**
 * Google Places suggestions for location fields.
 * Browser: Maps JavaScript Places library (referrer-restricted keys).
 * Server fallback: Next.js API routes (requires a non-referrer server key).
 */
import { safeFetch } from '@/lib/fetch/safeFetch';
import {
  clientPlaceDetails,
  clientPlacePredictions,
} from '@/lib/location/googlePlacesClient';
import type { LocationSuggestion } from '@/lib/location/types';

/** User must type more than 2 characters before suggestions run. */
export const LOCATION_SUGGEST_MIN_CHARS = 3;

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
  if (autoJson.status !== 'OK' && autoJson.status !== 'ZERO_RESULTS') {
    return [];
  }

  return (autoJson.predictions ?? []).slice(0, limit).map((p) => ({
    label: p.description,
    latitude: typeof p.latitude === 'number' ? p.latitude : 0,
    longitude: typeof p.longitude === 'number' ? p.longitude : 0,
    placeId: p.place_id,
  }));
}

async function serverPlaceDetails(
  placeId: string
): Promise<LocationSuggestion | null> {
  const res = await safeFetch(
    `/api/places/details?place_id=${encodeURIComponent(placeId)}`
  );
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

export async function searchGooglePlaceSuggestions(
  query: string,
  limit = 8
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < LOCATION_SUGGEST_MIN_CHARS) return [];

  if (typeof window !== 'undefined') {
    const clientRows = await clientPlacePredictions(trimmed, limit);
    if (clientRows.length > 0) return clientRows;
  }

  const serverRows = await serverPlacePredictions(trimmed, limit);
  return serverRows;
}

export async function resolveGooglePlaceSuggestion(
  suggestion: LocationSuggestion
): Promise<LocationSuggestion> {
  if (suggestion.latitude !== 0 && suggestion.longitude !== 0) {
    return suggestion;
  }
  if (!suggestion.placeId || suggestion.placeId.startsWith('osm:')) {
    return suggestion;
  }

  if (typeof window !== 'undefined') {
    const resolved = await clientPlaceDetails(suggestion.placeId);
    if (resolved) return resolved;
  }

  const serverResolved = await serverPlaceDetails(suggestion.placeId);
  return serverResolved ?? suggestion;
}
