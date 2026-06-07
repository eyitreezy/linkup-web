import type { DbMeetType, DbPlan } from '@/types/database';
import type { PlanFeedRow } from '@/services/plans.service';

export type DiscoveryMood = 'all' | 'chill' | 'active' | 'social' | 'premium';

const CHILL = ['coffee', 'chill', 'movie', 'read', 'tea', 'walk', 'park', 'cafe', 'brunch', 'relax', 'museum', 'gallery'];
const ACTIVE = ['run', 'gym', 'hike', 'sport', 'climb', 'bike', 'yoga', 'workout', 'fitness', 'swim', 'tennis', 'surf'];
const SOCIAL = ['party', 'club', 'bar', 'drinks', 'network', 'mixer', 'event', 'concert', 'dinner', 'karaoke', 'game night'];

function planTextBlob(row: DbPlan & { meet_types?: DbMeetType | null }): string {
  const mt = row.meet_types;
  return `${row.title} ${row.description ?? ''} ${row.category ?? ''} ${mt?.name ?? ''} ${mt?.slug ?? ''}`.toLowerCase();
}

export function planMatchesDiscoveryMood(
  row: DbPlan & { meet_types?: DbMeetType | null },
  mood: DiscoveryMood
): boolean {
  if (mood === 'all') return true;

  const blob = planTextBlob(row);
  const now = Date.now();
  const boosted = !!(row.boosted_until && new Date(row.boosted_until).getTime() > now);
  const paidSignal = !!(row.is_paid || (row.starting_price_cents != null && row.starting_price_cents > 0));

  if (mood === 'premium') {
    return paidSignal || boosted || !!row.is_mood_plan;
  }

  if (row.is_mood_plan) return true;

  const kw = mood === 'chill' ? CHILL : mood === 'active' ? ACTIVE : SOCIAL;
  return kw.some((k) => blob.includes(k));
}

export function filterPlansByMood(rows: PlanFeedRow[], mood: DiscoveryMood): PlanFeedRow[] {
  if (mood === 'all') return rows;
  return rows.filter((r) => planMatchesDiscoveryMood(r, mood));
}
