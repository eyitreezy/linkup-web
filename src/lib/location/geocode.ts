import { safeFetch } from '@/lib/fetch/safeFetch';
import { hasValidMapCoordinates } from '@/lib/maps/coordinates';

type GeocodeApiResponse = {
  status: string;
  result: { latitude: number; longitude: number } | null;
};

/** Resolve coordinates from a location label when plan rows lack lat/lng. */
export async function geocodeLocationLabel(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = address.trim();
  if (trimmed.length < 3) return null;

  const res = await safeFetch(`/api/places/geocode?address=${encodeURIComponent(trimmed)}`);
  if (!res?.ok) return null;

  try {
    const json = (await res.json()) as GeocodeApiResponse;
    if (json.status !== 'OK' || !json.result) return null;

    const { latitude, longitude } = json.result;
    if (!hasValidMapCoordinates(latitude, longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}
