import { distanceKm } from '@/lib/location/distance';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import type { PlanFeedRow } from '@/services/plans.service';

export type MoodReach = 'city' | 'city_adjacent' | 'city_widest' | 'all_cities';

/** Flat absolute km from plan meetup location — not tied to viewer `radius_km`. */
export const MOOD_REACH_KM: Record<MoodReach, number | null> = {
  city: 25,
  city_adjacent: 50,
  city_widest: 100,
  all_cities: null,
};

export const MOOD_REACH_LABELS: Record<MoodReach, string> = {
  city: 'City-wide · 25km',
  city_adjacent: 'City + nearby · 50km',
  city_widest: 'Widest reach · 100km',
  all_cities: 'All cities',
};

export function moodReachVisibleToViewer(
  plan: PlanFeedRow,
  viewerCoords: { lat: number; lng: number } | null,
  viewerId: string | undefined
): boolean {
  if (!plan.is_mood_plan) return true;
  if (viewerId && plan.creator_id === viewerId) return true;

  const reach = plan.mood_reach as MoodReach | null | undefined;
  if (!reach) return true;

  const reachKm = MOOD_REACH_KM[reach];
  if (reachKm === null) return true;

  const meetup = planMeetupCoords(plan);
  if (!meetup || !viewerCoords) return false;

  const distance = distanceKm(
    viewerCoords.lat,
    viewerCoords.lng,
    meetup.lat,
    meetup.lng
  );

  return distance <= reachKm;
}
