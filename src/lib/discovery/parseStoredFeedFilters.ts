import { hasDiscoverPriceFilter, normalizeDiscoverPriceCents } from '@/lib/discovery/discoverPriceFilter';

export type FeedFilterState = {
  /** `null` = no distance cap (empty filter on load). */
  maxDistanceKm: number | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  verifiedHostsOnly: boolean;
  hostPresence: 'all' | 'online' | 'offline';
  clientFiltersActive: boolean;
};

type StoredFeedFilters = {
  maxDistanceKm?: number | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  verifiedHostsOnly?: boolean;
  hostPresence?: 'all' | 'online' | 'offline';
  clientFiltersActive?: boolean;
  maxPrice?: number | null;
};

export function defaultDiscoverFeedFilter(): FeedFilterState {
  return {
    maxDistanceKm: null,
    minPriceCents: null,
    maxPriceCents: null,
    verifiedHostsOnly: false,
    hostPresence: 'all',
    clientFiltersActive: false,
  };
}

export function isDiscoverFilterConstraintActive(
  f: Pick<
    FeedFilterState,
    'maxDistanceKm' | 'minPriceCents' | 'maxPriceCents' | 'verifiedHostsOnly' | 'hostPresence'
  >
): boolean {
  if (f.maxDistanceKm != null) return true;
  if (f.hostPresence !== 'all') return true;
  if (f.verifiedHostsOnly) return true;
  if (hasDiscoverPriceFilter(f)) return true;
  return false;
}

/** True when price, verified-host, or host-presence constraints are set (excludes distance). */
export function hasAdvancedDiscoverFilters(
  f: Pick<
    FeedFilterState,
    'minPriceCents' | 'maxPriceCents' | 'verifiedHostsOnly' | 'hostPresence'
  >
): boolean {
  if (f.hostPresence !== 'all') return true;
  if (f.verifiedHostsOnly) return true;
  if (hasDiscoverPriceFilter(f)) return true;
  return false;
}

/** True when a max-distance cap is applied to the feed. */
export function isDistanceFilterActive(
  filter: Pick<FeedFilterState, 'maxDistanceKm'>
): boolean {
  return filter.maxDistanceKm != null;
}

export function parseStoredFeedFilters(
  raw: unknown,
  _fallbackMaxKm: number,
  _sliderMaxKm?: number
): FeedFilterState {
  const defaults = defaultDiscoverFeedFilter();
  if (!raw || typeof raw !== 'object') return defaults;

  const f = raw as StoredFeedFilters;
  // Distance is never restored from profile — always empty on app load.
  const draft = {
    maxDistanceKm: null,
    minPriceCents: normalizeDiscoverPriceCents(f.minPriceCents),
    maxPriceCents: normalizeDiscoverPriceCents(f.maxPriceCents),
    verifiedHostsOnly: !!f.verifiedHostsOnly,
    hostPresence:
      f.hostPresence === 'online' || f.hostPresence === 'offline' ? f.hostPresence : ('all' as const),
  };

  const clientFiltersActive = isDiscoverFilterConstraintActive(draft);

  if (!clientFiltersActive) return defaults;

  return { ...draft, clientFiltersActive: true };
}
