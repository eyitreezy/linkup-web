/** True when coordinates can be shown on a map (excludes null and 0,0 placeholders). */
export function hasValidMapCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

export function toMapCenter(latitude: number, longitude: number): { lat: number; lng: number } {
  return { lat: latitude, lng: longitude };
}
