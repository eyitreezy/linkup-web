import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { filterPlansByMood } from '@/lib/discovery/moodFilter';
import {
  hostPresenceMatchesFilter,
  resolveHostPresenceKind,
} from '@/lib/presence/hostPresenceStatus';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { rankDiscoveryPlans } from '@/lib/plans/feedRanking';
import { filterPremiumVisibilityPlans } from '@/lib/plans/premiumVisibilityFilter';
import type { SubscriptionTier } from '@/lib/subscription/types';
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

/** Proximity-aware discover ordering — mood → tier → boost → distance → recency. */
export function sortDiscoverRows(
  rows: PlanFeedRow[],
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  return rankDiscoveryPlans(rows, { effectiveLat: viewerLat, effectiveLng: viewerLng });
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
    browseRadiusKm?: number;
    viewerProfile?: DbProfile | null;
    presenceByUser?: Record<string, DbUserPresence>;
    effectiveTier?: SubscriptionTier;
    hiddenPlanIds?: Set<string>;
  }
): PlanFeedRow[] {
  const {
    mood,
    filter,
    viewerId,
    viewerLat,
    viewerLng,
    baseRadiusKm,
    browseRadiusKm,
    viewerProfile,
    presenceByUser,
    effectiveTier = 'FREE',
    hiddenPlanIds,
  } = opts;
  let out = filterPlansByMood(rows, mood);
  out = filterPremiumVisibilityPlans(out, effectiveTier);
  if (hiddenPlanIds?.size) {
    out = out.filter((row) => !hiddenPlanIds.has(row.id));
  }
  const maxKm = filter.maxDistanceKm ?? browseRadiusKm ?? baseRadiusKm;

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
        presenceByUser[row.creator_id] ?? null,
        !!row.creator?.masked_activity_enabled
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
