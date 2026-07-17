import { distanceKm } from '@/lib/location/distance';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import type { PlanFeedRow } from '@/services/plans.service';

export type PlanDistanceLabelStyle = 'pill' | 'line';

export function planHasMeetupCoords(
  plan: Pick<PlanFeedRow, 'meetup_latitude' | 'meetup_longitude' | 'latitude' | 'longitude'>
): boolean {
  return planMeetupCoords(plan) != null;
}

/** Sort key — full meter precision from haversine km. */
export function planDistanceMetersFromViewer(
  plan: Pick<PlanFeedRow, 'meetup_latitude' | 'meetup_longitude' | 'latitude' | 'longitude'>,
  viewerLat: number | null,
  viewerLng: number | null
): number {
  if (viewerLat == null || viewerLng == null) return Number.POSITIVE_INFINITY;
  const meetup = planMeetupCoords(plan);
  if (!meetup) return Number.POSITIVE_INFINITY;
  const km = distanceKm(viewerLat, viewerLng, meetup.lat, meetup.lng);
  if (!Number.isFinite(km)) return Number.POSITIVE_INFINITY;
  return Math.round(km * 1000);
}

/** User-facing distance copy on discover / plan cards. */
export function formatPlanDistanceLabel(opts: {
  distanceKm: number | null;
  viewerHasLocation: boolean;
  planHasLocation: boolean;
  style?: PlanDistanceLabelStyle;
}): string {
  const { distanceKm, viewerHasLocation, planHasLocation, style = 'pill' } = opts;

  if (distanceKm != null) {
    if (distanceKm < 1) {
      const meters = Math.max(1, Math.round(distanceKm * 1000));
      return style === 'line' ? `${meters} m away` : `${meters} m`;
    }
    return style === 'line' ? `${distanceKm.toFixed(1)} km away` : `${distanceKm.toFixed(1)} km`;
  }

  if (!viewerHasLocation) return 'Enable location';
  if (!planHasLocation) return 'Nearby';
  return 'Nearby';
}
