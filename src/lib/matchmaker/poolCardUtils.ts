import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';

export function poolProfilePhotoUri(profile: PoolProfileRow): string | null {
  return profile.primary_photo_url ?? profile.photo_urls?.[0] ?? profile.avatar_url ?? null;
}

export function formatPoolDistanceLabel(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return '< 1 km';
  return `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km`;
}
