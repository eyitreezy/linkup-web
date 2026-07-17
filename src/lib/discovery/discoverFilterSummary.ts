import type { FeedFilterState } from '@/lib/discovery/feedFilters';
import { isDiscoverFilterConstraintActive } from '@/lib/discovery/parseStoredFeedFilters';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';

const MOOD_LABELS: Record<DiscoveryMood, string> = {
  all: 'All vibes',
  chill: 'Chill',
  active: 'Active',
  social: 'Social',
  premium: 'Premium',
};

const PRESENCE_LABELS: Record<FeedFilterState['hostPresence'], string> = {
  all: 'All hosts',
  online: 'Online now',
  offline: 'Offline',
};

export function isDiscoverFiltersActive(filter: FeedFilterState, mood: DiscoveryMood): boolean {
  return mood !== 'all' || isDiscoverFilterConstraintActive(filter);
}

/** Short line for the mobile filter toggle when collapsed. */
export function discoverFilterSummary(filter: FeedFilterState, mood: DiscoveryMood): string {
  const parts: string[] = [];
  if (mood !== 'all') parts.push(MOOD_LABELS[mood]);
  if (filter.maxDistanceKm != null) parts.push(`${filter.maxDistanceKm} km`);
  if (filter.hostPresence !== 'all') parts.push(PRESENCE_LABELS[filter.hostPresence]);
  if (filter.verifiedHostsOnly) parts.push('Verified');
  if (filter.minPriceCents != null || filter.maxPriceCents != null) parts.push('Price');
  return parts.length > 0 ? parts.join(' · ') : 'Default feed';
}
