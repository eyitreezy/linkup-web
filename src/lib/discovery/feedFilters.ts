import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { filterPlansByMood } from '@/lib/discovery/moodFilter';
import {
  hostPresenceMatchesFilter,
  resolveHostPresenceKind,
} from '@/lib/presence/hostPresenceStatus';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import {
  parseStoredFeedFilters,
  type FeedFilterState,
} from '@/lib/discovery/parseStoredFeedFilters';
import { distanceKm } from '@/lib/location/distance';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbProfile, DbUserPresence } from '@/types/database';

export type { FeedFilterState };
export {
  defaultDiscoverFeedFilter,
  parseStoredFeedFilters,
  isDiscoverFilterConstraintActive,
} from '@/lib/discovery/parseStoredFeedFilters';

/** Distance in km from viewer to plan; missing coords sort last. */
export function planDistanceFromViewer(
  plan: Pick<PlanFeedRow, 'latitude' | 'longitude'>,
  viewerLat: number | null,
  viewerLng: number | null
): number {
  if (viewerLat == null || viewerLng == null) return Infinity;
  if (plan.latitude == null || plan.longitude == null) return Infinity;
  return distanceKm(viewerLat, viewerLng, plan.latitude, plan.longitude);
}

/**
 * Default discover ordering — proximity-first (Tinder / Hinge / Badoo style).
 * Mirrors mobile `rebuildRows` in app/(tabs)/index.tsx:
 * live mood → boost → nearest plan → newest.
 */
export function sortDiscoverRows(
  rows: PlanFeedRow[],
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  const hasViewerCoords = viewerLat != null && viewerLng != null;
  const moodDeadline = (p: PlanFeedRow) =>
    p.is_mood_plan && p.mood_expires_at ? new Date(p.mood_expires_at).getTime() : Infinity;

  return [...rows].sort((a, b) => {
    if (a.is_mood_plan !== b.is_mood_plan) return a.is_mood_plan ? -1 : 1;

    if (a.is_mood_plan && b.is_mood_plan) {
      const ma = moodDeadline(a);
      const mb = moodDeadline(b);
      if (ma !== mb) return ma - mb;
    }

    const ba = isPlanBoostActive(a.boosted_until) ? 1 : 0;
    const bb = isPlanBoostActive(b.boosted_until) ? 1 : 0;
    if (ba !== bb) return bb - ba;

    if (hasViewerCoords) {
      if (a.latitude == null || a.longitude == null) return 1;
      if (b.latitude == null || b.longitude == null) return -1;

      const da = planDistanceFromViewer(a, viewerLat, viewerLng);
      const db = planDistanceFromViewer(b, viewerLat, viewerLng);
      if (da !== db) return da - db;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function applyDiscoverFilters(
  rows: PlanFeedRow[],
  opts: {
    mood: DiscoveryMood;
    filter: FeedFilterState;
    viewerId?: string;
    viewerLat: number | null;
    viewerLng: number | null;
    baseRadiusKm: number;
    viewerProfile?: DbProfile | null;
    presenceByUser?: Record<string, DbUserPresence>;
  }
): PlanFeedRow[] {
  const { mood, filter, viewerId, viewerLat, viewerLng, baseRadiusKm, viewerProfile, presenceByUser } =
    opts;
  let out = filterPlansByMood(rows, mood);
  const maxKm = filter.maxDistanceKm ?? baseRadiusKm;

  out = out.filter((row) => {
    if (row.is_mood_plan && isPlanMoodWindowClosed(row)) return false;
    if (viewerId && row.creator_id === viewerId) return true;
    if (!filter.clientFiltersActive) return true;
    if (filter.verifiedHostsOnly && !row.creator?.verified_badge) return false;
    const price = row.starting_price_cents;
    if (filter.minPriceCents != null) {
      if (price == null || price < filter.minPriceCents) return false;
    }
    if (filter.maxPriceCents != null) {
      if (price != null && price > filter.maxPriceCents) return false;
    }
    if (
      row.latitude != null &&
      row.longitude != null &&
      viewerLat != null &&
      viewerLng != null
    ) {
      const d = planDistanceFromViewer(row, viewerLat, viewerLng);
      if (d > maxKm) return false;
    }
    if (filter.hostPresence !== 'all' && presenceByUser) {
      const kind = resolveHostPresenceKind(
        viewerProfile ?? null,
        row.creator?.preferences,
        presenceByUser[row.creator_id] ?? null
      );
      if (!hostPresenceMatchesFilter(kind, filter.hostPresence)) return false;
    }
    return true;
  });

  return sortDiscoverRows(out, viewerLat, viewerLng);
}

export function loadFeedFilterFromProfile(profile: DbProfile | null, fallbackMaxKm: number): FeedFilterState {
  const raw = profile?.preferences?.feed_filters;
  return parseStoredFeedFilters(raw, fallbackMaxKm);
}

/** Mood plans with an open window — for timeline carousel. */
export function moodTimelinePlans(rows: PlanFeedRow[]): PlanFeedRow[] {
  return rows.filter((r) => r.is_mood_plan && !isPlanMoodWindowClosed(r));
}

/** Standard (non-mood) discover rows. */
export function standardDiscoverPlans(rows: PlanFeedRow[]): PlanFeedRow[] {
  return rows.filter((r) => !r.is_mood_plan);
}
