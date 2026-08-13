import { distanceKm } from '@/lib/location/distance';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { PlanFeedRow } from '@/services/plans.service';

export type MoodReach = 'city' | 'city_adjacent' | 'city_widest' | 'all_cities';

/** Flat absolute km from plan meetup location — not tied to viewer `radius_km`. */
export const MOOD_REACH_KM: Record<MoodReach, number | null> = {
  city: 20,
  city_adjacent: 35,
  city_widest: 50,
  all_cities: null,
};

export const MOOD_REACH_LABELS: Record<MoodReach, string> = {
  city: 'City-wide · 20km',
  city_adjacent: 'City + nearby · 35km',
  city_widest: 'Widest reach · 50km',
  all_cities: 'All cities',
};

export const MOOD_REACH_LABELS_BY_TIER: Record<SubscriptionTier, string> = {
  FREE: MOOD_REACH_LABELS.city,
  SILVER: MOOD_REACH_LABELS.city_adjacent,
  GOLD: MOOD_REACH_LABELS.city_widest,
  PLATINUM: MOOD_REACH_LABELS.all_cities,
};

export function moodReachKeyForTier(tier: SubscriptionTier): MoodReach {
  if (tier === 'PLATINUM') return 'all_cities';
  if (tier === 'GOLD') return 'city_widest';
  if (tier === 'SILVER') return 'city_adjacent';
  return 'city';
}

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
