export type FeedFilterState = {
  maxDistanceKm: number;
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

function normalizePriceCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function defaultDiscoverFeedFilter(fallbackMaxKm: number): FeedFilterState {
  return {
    maxDistanceKm: fallbackMaxKm,
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
  >,
  baseRadiusKm: number
): boolean {
  if (f.hostPresence !== 'all') return true;
  if (f.verifiedHostsOnly) return true;
  if (f.minPriceCents != null) return true;
  if (f.maxPriceCents != null) return true;
  if (f.maxDistanceKm !== baseRadiusKm) return true;
  return false;
}

export function parseStoredFeedFilters(raw: unknown, fallbackMaxKm: number): FeedFilterState {
  const defaults = defaultDiscoverFeedFilter(fallbackMaxKm);
  if (!raw || typeof raw !== 'object') return defaults;

  const f = raw as StoredFeedFilters;
  const draft = {
    maxDistanceKm:
      typeof f.maxDistanceKm === 'number' && f.maxDistanceKm > 0 ? f.maxDistanceKm : fallbackMaxKm,
    minPriceCents: normalizePriceCents(f.minPriceCents),
    maxPriceCents: f.clientFiltersActive === true ? normalizePriceCents(f.maxPriceCents) : null,
    verifiedHostsOnly: !!f.verifiedHostsOnly,
    hostPresence:
      f.hostPresence === 'online' || f.hostPresence === 'offline' ? f.hostPresence : ('all' as const),
  };

  const clientFiltersActive =
    f.clientFiltersActive === true || isDiscoverFilterConstraintActive(draft, fallbackMaxKm);

  if (!clientFiltersActive) return defaults;

  return { ...draft, clientFiltersActive: true };
}
