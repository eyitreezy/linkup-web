import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { filterPlansByMood } from '@/lib/discovery/moodFilter';
import {
  hostPresenceMatchesFilter,
  resolveHostPresenceKind,
} from '@/lib/presence/hostPresenceStatus';
import { isPlanListingExpired, isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { rankDiscoveryPlans, rankMoodTimelinePlans } from '@/lib/plans/feedRanking';
import { moodReachVisibleToViewer } from '@/lib/plans/moodReachFilter';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import { applyRadiusVisibilityFilter } from '@/lib/plans/planVisibilityConfig';
import { filterTierRelativePremiumVisibilityPlans } from '@/lib/plans/tierRelativePremiumVisibility';
import type { SubscriptionTier } from '@/lib/subscription/types';
import {
  parseStoredFeedFilters,
  hasAdvancedDiscoverFilters,
  isDistanceFilterActive,
  type FeedFilterState,
  type PlanTypeFilter,
} from '@/lib/discovery/parseStoredFeedFilters';
import { distanceKm } from '@/lib/location/distance';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbProfile, DbUserPresence } from '@/types/database';

export type { FeedFilterState, PlanTypeFilter };
export {
  defaultDiscoverFeedFilter,
  parseStoredFeedFilters,
  isDiscoverFilterConstraintActive,
  hasAdvancedDiscoverFilters,
  isDistanceFilterActive,
} from '@/lib/discovery/parseStoredFeedFilters';

export function filterDiscoverPlan(plan: PlanFeedRow): boolean {
  if (plan.status === 'awaiting_payment' && !plan.is_group_plan) {
    return false;
  }
  return true;
}

import {
  applyDiscoverPriceFilterToRows,
  discoverPriceFilterBounds,
  hasDiscoverPriceFilter,
  passesDiscoverPriceFilter,
  planPassesDiscoverPriceFilter,
  resolvePlanFilterPriceCents,
} from '@/lib/discovery/discoverPriceFilter';

export type { DiscoverPriceFilter } from '@/lib/discovery/discoverPriceFilter';
export {
  hasDiscoverPriceFilter,
  passesDiscoverPriceFilter,
  planPassesDiscoverPriceFilter,
  resolvePlanFilterPriceCents,
  validateDiscoverPriceRange,
  normalizeDiscoverPriceCents,
  applyDiscoverPriceFilterToRows,
} from '@/lib/discovery/discoverPriceFilter';

/** Verified-host gate — price uses {@link passesDiscoverPriceFilter}. */
export function passesVerifiedHostFilter(
  row: PlanFeedRow,
  verifiedHostsOnly: boolean
): boolean {
  if (!verifiedHostsOnly) return true;
  return !!row.creator?.verified_badge;
}

/** Price / verified-host gate — mirrors mobile `rebuildRows` client filter block. */
export function passesAdvancedDiscoverFilters(
  row: PlanFeedRow,
  filter: Pick<FeedFilterState, 'verifiedHostsOnly' | 'minPriceCents' | 'maxPriceCents'>
): boolean {
  if (!passesVerifiedHostFilter(row, filter.verifiedHostsOnly)) return false;
  if (
    hasDiscoverPriceFilter(filter) &&
    !planPassesDiscoverPriceFilter(row, filter)
  ) {
    return false;
  }
  return true;
}

/** Distance in km from viewer search origin to plan meetup pin; missing coords sort last. */
export function planDistanceFromViewer(
  plan: Pick<PlanFeedRow, 'meetup_latitude' | 'meetup_longitude' | 'latitude' | 'longitude'>,
  viewerLat: number | null,
  viewerLng: number | null
): number {
  if (viewerLat == null || viewerLng == null) return Infinity;
  const meetup = planMeetupCoords(plan);
  if (!meetup) return Infinity;
  return distanceKm(viewerLat, viewerLng, meetup.lat, meetup.lng);
}

/** Discover ordering — promotion lane then organic km ascending, or strict km when filtered. */
export function sortDiscoverRows(
  rows: PlanFeedRow[],
  viewerLat: number | null,
  viewerLng: number | null,
  options?: { sortDistanceAscending?: boolean }
): PlanFeedRow[] {
  return rankDiscoveryPlans(rows, {
    effectiveLat: viewerLat,
    effectiveLng: viewerLng,
    sortDistanceAscending: options?.sortDistanceAscending,
  });
}

/** Hard eligibility gate — only plans within maxDistanceKm (strict; no exemptions). */
export function applyMaxDistanceFilter(
  rows: PlanFeedRow[],
  opts: {
    maxDistanceKm: number;
    viewerLat: number | null;
    viewerLng: number | null;
  }
): PlanFeedRow[] {
  const { maxDistanceKm, viewerLat, viewerLng } = opts;
  if (viewerLat == null || viewerLng == null) return [];

  const ceiling = Math.max(1, maxDistanceKm);

  return rows.filter((row) => {
    const meetup = planMeetupCoords(row);
    if (!meetup) return false;
    const d = planDistanceFromViewer(row, viewerLat, viewerLng);
    return Number.isFinite(d) && d <= ceiling;
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
    viewerProfile,
    presenceByUser,
    effectiveTier = 'FREE',
    hiddenPlanIds,
  } = opts;
  let out = rows.filter(filterDiscoverPlan);
  out = filterPlansByMood(out, mood);

  if (viewerId) {
    out = out.filter((row) => row.creator_id !== viewerId);
  }

  if (filter.planTypeFilter && filter.planTypeFilter !== 'all') {
    out = out.filter((plan) => {
      if (filter.planTypeFilter === 'group') return !!plan.is_group_plan;
      if (filter.planTypeFilter === 'mood') return !!plan.is_mood_plan;
      if (filter.planTypeFilter === 'standard') return !plan.is_group_plan && !plan.is_mood_plan;
      return true;
    });
  }

  out = filterTierRelativePremiumVisibilityPlans(
    out,
    viewerId ?? null,
    effectiveTier,
    viewerLat,
    viewerLng
  );
  if (hiddenPlanIds?.size) {
    out = out.filter((row) => !hiddenPlanIds.has(row.id));
  }

  const viewerCoords =
    viewerLat != null && viewerLng != null ? { lat: viewerLat, lng: viewerLng } : null;

  out = applyRadiusVisibilityFilter(out, viewerId, viewerCoords);

  out = out.filter((row) => moodReachVisibleToViewer(row, viewerCoords, viewerId));

  const maxKm =
    filter.maxDistanceKm != null ? Math.max(1, Math.round(filter.maxDistanceKm)) : null;
  const distanceFilterActive = isDistanceFilterActive(filter);
  const priceFilterActive = hasDiscoverPriceFilter(filter);
  const priceBounds = discoverPriceFilterBounds(filter);

  if (distanceFilterActive && maxKm != null) {
    out = applyMaxDistanceFilter(out, {
      maxDistanceKm: maxKm,
      viewerLat,
      viewerLng,
    });
  }

  // Price filter applies to all remaining discover rows.
  if (priceFilterActive) {
    out = applyDiscoverPriceFilterToRows(out, priceBounds);
  }

  out = out.filter((row) => {
    if (isPlanListingExpired(row)) return false;

    if (filter.verifiedHostsOnly && !passesVerifiedHostFilter(row, filter.verifiedHostsOnly)) {
      return false;
    }

    if (filter.hostPresence !== 'all') {
      if (presenceByUser) {
        const kind = resolveHostPresenceKind(
          viewerProfile ?? null,
          row.creator?.preferences,
          presenceByUser[row.creator_id] ?? null,
          !!row.creator?.masked_activity_enabled
        );
        if (!hostPresenceMatchesFilter(kind, filter.hostPresence)) return false;
      }
    }
    return true;
  });

  if (distanceFilterActive && maxKm != null) {
    out = applyMaxDistanceFilter(out, {
      maxDistanceKm: maxKm,
      viewerLat,
      viewerLng,
    });
  }

  const hasViewerCoords = viewerLat != null && viewerLng != null;

  return sortDiscoverRows(out, viewerLat, viewerLng, {
    sortDistanceAscending: hasViewerCoords,
  });
}

export function loadFeedFilterFromProfile(
  profile: DbProfile | null,
  fallbackMaxKm: number,
  sliderMaxKm?: number
): FeedFilterState {
  const raw = profile?.preferences?.feed_filters;
  return parseStoredFeedFilters(raw, fallbackMaxKm, sliderMaxKm);
}

/** Mood plans with an open window — sorted for timeline carousel. */
export function moodTimelinePlans(
  rows: PlanFeedRow[],
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  const live = rows.filter((r) => r.is_mood_plan && !isPlanMoodWindowClosed(r));
  return rankMoodTimelinePlans(live, { effectiveLat: viewerLat, effectiveLng: viewerLng });
}

/** Standard (non-mood) discover rows. */
export function standardDiscoverPlans(rows: PlanFeedRow[]): PlanFeedRow[] {
  return rows.filter((r) => !r.is_mood_plan);
}
