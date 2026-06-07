import type { DbProfile } from '@/types/database';

export type ViewerGeoCoords = { lat: number; lng: number };

/**
 * Browse pin for discover distance sort + radius.
 * Priority (matches LinkUp mobile discover tab):
 * 1. Premium travel mode pin
 * 2. Device / browser geolocation
 * 3. Profile home coordinates
 */
export function resolveDiscoverViewerCoords(
  profile: DbProfile | null,
  isPremium: boolean,
  deviceCoords?: ViewerGeoCoords | null
): { lat: number | null; lng: number | null } {
  const travel = profile?.preferences?.travel_mode;
  if (
    isPremium &&
    travel &&
    typeof travel.latitude === 'number' &&
    typeof travel.longitude === 'number'
  ) {
    return { lat: travel.latitude, lng: travel.longitude };
  }

  if (deviceCoords?.lat != null && deviceCoords?.lng != null) {
    return { lat: deviceCoords.lat, lng: deviceCoords.lng };
  }

  return {
    lat: profile?.latitude ?? null,
    lng: profile?.longitude ?? null,
  };
}
