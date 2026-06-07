import type { MoodListingHours } from '@/lib/plans/moodPlanComputations';
import type { DbPlan } from '@/types/database';

export const MOOD_TYPE_OPTIONS = ['Chill', 'Active', 'Social', 'Premium vibe'] as const;

export const MOOD_LISTING_HOUR_OPTIONS: MoodListingHours[] = [1, 3, 6, 12, 24];

/** Map stored expiry window to nearest standard listing-hours chip. */
export function deriveMoodListingHours(plan: Pick<DbPlan, 'mood_expires_at' | 'created_at'>): MoodListingHours {
  if (!plan.mood_expires_at) return 3;
  const start = plan.created_at ? new Date(plan.created_at).getTime() : Date.now();
  const end = new Date(plan.mood_expires_at).getTime();
  const rawHours = Math.max(1, Math.round((end - start) / (3600 * 1000)));
  let best: MoodListingHours = 3;
  let bestDelta = Infinity;
  for (const h of MOOD_LISTING_HOUR_OPTIONS) {
    const d = Math.abs(h - rawHours);
    if (d < bestDelta) {
      bestDelta = d;
      best = h;
    }
  }
  return best;
}
