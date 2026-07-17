import type { PlanFeedRow } from '@/services/plans.service';

export type PlanMeetupCoords = { lat: number; lng: number };

/** Plan meetup pin — prefers `meetup_*` when stamped; never uses creator profile coords. */
export function planMeetupCoords(
  plan: Pick<PlanFeedRow, 'meetup_latitude' | 'meetup_longitude' | 'latitude' | 'longitude'>
): PlanMeetupCoords | null {
  const lat = plan.meetup_latitude ?? plan.latitude;
  const lng = plan.meetup_longitude ?? plan.longitude;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}
