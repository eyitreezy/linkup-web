import { planDistanceFromViewer } from '@/lib/discovery/feedFilters';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { TIER_ORDER } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { PlanFeedRow } from '@/services/plans.service';

export type RankDiscoveryOptions = {
  effectiveLat: number | null;
  effectiveLng: number | null;
  now?: Date;
};

function tierRankForRow(row: PlanFeedRow): number {
  if (row.host_tier_rank != null && row.host_tier_rank > 0) return row.host_tier_rank;
  const tier = (row.host_tier ?? row.creator?.subscription_tier ?? 'FREE') as SubscriptionTier;
  const idx = TIER_ORDER.indexOf(tier);
  return idx >= 0 ? idx : 0;
}

/** Mood first → tier rank → creator spotlight → boost → distance → recency. */
export function rankDiscoveryPlans(rows: PlanFeedRow[], opts?: RankDiscoveryOptions): PlanFeedRow[] {
  const lat = opts?.effectiveLat ?? null;
  const lng = opts?.effectiveLng ?? null;
  const now = opts?.now ?? new Date();
  const moodDeadline = (p: PlanFeedRow) =>
    p.is_mood_plan && p.mood_expires_at ? new Date(p.mood_expires_at).getTime() : Infinity;

  return [...rows].sort((a, b) => {
    if (a.is_mood_plan !== b.is_mood_plan) return a.is_mood_plan ? -1 : 1;
    if (a.is_mood_plan && b.is_mood_plan) {
      const ma = moodDeadline(a);
      const mb = moodDeadline(b);
      if (ma !== mb) return ma - mb;
    }

    const tierDiff = tierRankForRow(b) - tierRankForRow(a);
    if (tierDiff !== 0) return tierDiff;

    const aSpotlighted = isCreatorSpotlightActive(a.creator?.spotlight_until, now);
    const bSpotlighted = isCreatorSpotlightActive(b.creator?.spotlight_until, now);
    if (aSpotlighted !== bSpotlighted) return bSpotlighted ? 1 : -1;

    const ba = isPlanBoostActive(a.boosted_until) ? 1 : 0;
    const bb = isPlanBoostActive(b.boosted_until) ? 1 : 0;
    if (ba !== bb) return bb - ba;

    if (lat != null && lng != null) {
      if (a.latitude == null || a.longitude == null) return 1;
      if (b.latitude == null || b.longitude == null) return -1;
      const da = planDistanceFromViewer(a, lat, lng);
      const db = planDistanceFromViewer(b, lat, lng);
      if (da !== db) return da - db;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
