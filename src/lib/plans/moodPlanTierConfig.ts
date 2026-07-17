import type { SubscriptionTier } from '@/lib/subscription/types';
import type { MoodListingHours } from '@/lib/plans/moodPlanComputations';
import { MOOD_REACH_LABELS as MOOD_REACH_KM_LABELS } from '@/lib/plans/moodReachFilter';

export const MOOD_WINDOW_CAP_HOURS: Record<SubscriptionTier, number> = {
  FREE: 24,
  SILVER: 36,
  GOLD: 48,
  PLATINUM: 48,
};

export const MOOD_REACH_LABELS: Record<SubscriptionTier, string> = {
  FREE: MOOD_REACH_KM_LABELS.city,
  SILVER: MOOD_REACH_KM_LABELS.city_adjacent,
  GOLD: MOOD_REACH_KM_LABELS.city_widest,
  PLATINUM: MOOD_REACH_KM_LABELS.all_cities,
};

export const MOOD_REACH_DISPLAY: Record<string, string> = {
  city: MOOD_REACH_KM_LABELS.city,
  city_adjacent: MOOD_REACH_KM_LABELS.city_adjacent,
  city_widest: MOOD_REACH_KM_LABELS.city_widest,
  all_cities: MOOD_REACH_KM_LABELS.all_cities,
};

export const MOOD_LISTING_OPTIONS: { h: MoodListingHours; label: string }[] = [
  { h: 1, label: '1h' },
  { h: 3, label: '3h' },
  { h: 6, label: '6h' },
  { h: 12, label: '12h' },
  { h: 24, label: '24h' },
];

export function tierForListingHours(h: number): SubscriptionTier | null {
  if (h <= 24) return null;
  if (h <= 36) return 'SILVER';
  if (h <= 48) return 'GOLD';
  return 'PLATINUM';
}

export function clampMoodListingHours(
  hours: MoodListingHours,
  effectiveTier: SubscriptionTier
): MoodListingHours {
  const cap = MOOD_WINDOW_CAP_HOURS[effectiveTier] ?? 24;
  if (hours <= cap) return hours;
  const allowed = MOOD_LISTING_OPTIONS.filter((o) => o.h <= cap).map((o) => o.h);
  return (allowed.length ? Math.max(...allowed) : 24) as MoodListingHours;
}
