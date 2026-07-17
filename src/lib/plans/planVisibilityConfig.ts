import { distanceKm } from '@/lib/location/distance';
import { planMeetupCoords, type PlanMeetupCoords } from '@/lib/plans/planMeetupCoords';
import type { PlanFeedRow } from '@/services/plans.service';

/** Fixed geographic gate for `visibility='radius'` plans — matches backend RLS. */
export const RADIUS_VISIBILITY_KM = 50;

export function applyRadiusVisibilityFilter(
  plans: PlanFeedRow[],
  viewerId: string | undefined,
  effectiveCoords: PlanMeetupCoords | null
): PlanFeedRow[] {
  return plans.filter((plan) => {
    if (plan.visibility !== 'radius') return true;
    if (viewerId && plan.creator_id === viewerId) return true;

    const meetup = planMeetupCoords(plan);
    if (!meetup) return true;

    if (!effectiveCoords) return false;

    const d = distanceKm(
      effectiveCoords.lat,
      effectiveCoords.lng,
      meetup.lat,
      meetup.lng
    );
    return d <= RADIUS_VISIBILITY_KM;
  });
}
