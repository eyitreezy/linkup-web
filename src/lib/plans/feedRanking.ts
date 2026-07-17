import { planDistanceMetersFromViewer } from '@/lib/plans/planDistanceLabel';
import type { PlanFeedRow } from '@/services/plans.service';

export type RankDiscoveryOptions = {
  effectiveLat: number | null;
  effectiveLng: number | null;
  /** When true (and viewer coords exist), strict meter-ascending order. */
  sortDistanceAscending?: boolean;
};

function compareDistanceAsc(
  a: PlanFeedRow,
  b: PlanFeedRow,
  lat: number | null,
  lng: number | null
): number {
  const da = planDistanceMetersFromViewer(a, lat, lng);
  const db = planDistanceMetersFromViewer(b, lat, lng);
  if (da !== db) return da - db;
  return 0;
}

function compareRecencyDesc(a: PlanFeedRow, b: PlanFeedRow): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Discover grid / list / swipe — nearest first (meter precision) when coords exist. */
export function rankDiscoveryPlans(rows: PlanFeedRow[], opts?: RankDiscoveryOptions): PlanFeedRow[] {
  const lat = opts?.effectiveLat ?? null;
  const lng = opts?.effectiveLng ?? null;
  const useProximitySort = opts?.sortDistanceAscending && lat != null && lng != null;

  return [...rows].sort((a, b) => {
    if (useProximitySort) {
      const distCmp = compareDistanceAsc(a, b, lat, lng);
      if (distCmp !== 0) return distCmp;
      return compareRecencyDesc(a, b);
    }

    const distCmp = compareDistanceAsc(a, b, lat, lng);
    if (distCmp !== 0) return distCmp;

    return compareRecencyDesc(a, b);
  });
}

/** Mood timeline: soonest expiry first, then meters ascending, then recency. */
export function rankMoodTimelinePlans(
  rows: PlanFeedRow[],
  opts?: Pick<RankDiscoveryOptions, 'effectiveLat' | 'effectiveLng'>
): PlanFeedRow[] {
  const lat = opts?.effectiveLat ?? null;
  const lng = opts?.effectiveLng ?? null;

  const moodDeadline = (p: PlanFeedRow) =>
    p.mood_expires_at ? new Date(p.mood_expires_at).getTime() : Number.POSITIVE_INFINITY;

  return [...rows].sort((a, b) => {
    const ma = moodDeadline(a);
    const mb = moodDeadline(b);
    if (ma !== mb) return ma - mb;

    const distCmp = compareDistanceAsc(a, b, lat, lng);
    if (distCmp !== 0) return distCmp;

    return compareRecencyDesc(a, b);
  });
}
