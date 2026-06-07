'use client';

import {
  loadFeedFilterFromProfile,
  type FeedFilterState,
} from '@/lib/discovery/feedFilters';
import { resolveDiscoverViewerCoords } from '@/lib/discovery/viewerLocation';
import { useViewerGeolocation } from '@/hooks/use-viewer-geolocation';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import type { DbProfile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type DiscoverPageContextValue = {
  mood: DiscoveryMood;
  filter: FeedFilterState;
  baseRadiusKm: number;
  viewerLat: number | null;
  viewerLng: number | null;
  isPremium: boolean;
  profileLoading: boolean;
  viewerProfile: DbProfile | null;
  applyFilters: (next: FeedFilterState, nextMood: DiscoveryMood) => void;
};

const DiscoverPageContext = createContext<DiscoverPageContextValue | null>(null);

export function DiscoverPageProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [mood, setMood] = useState<DiscoveryMood>('all');
  const [filter, setFilter] = useState<FeedFilterState | null>(null);

  const profileQuery = useQuery({
    queryKey: ['discover-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      return fetchUserProfileBundle(client, user.id);
    },
    enabled: !!user?.id,
  });

  const baseRadiusKm = profileQuery.data?.profile?.radius_km
    ? Number(profileQuery.data.profile.radius_km)
    : 50;
  const isPremium = !!(
    profileQuery.data?.dbUser?.premium_until &&
    new Date(profileQuery.data.dbUser.premium_until).getTime() > Date.now()
  );

  const deviceCoords = useViewerGeolocation(!!user?.id);
  const viewerCoords = resolveDiscoverViewerCoords(
    profileQuery.data?.profile ?? null,
    isPremium,
    deviceCoords
  );
  const viewerLat = viewerCoords.lat;
  const viewerLng = viewerCoords.lng;

  useEffect(() => {
    if (filter == null && profileQuery.data?.profile) {
      setFilter(loadFeedFilterFromProfile(profileQuery.data.profile, baseRadiusKm));
    }
  }, [filter, profileQuery.data?.profile, baseRadiusKm]);

  const activeFilter = useMemo(
    () => filter ?? loadFeedFilterFromProfile(profileQuery.data?.profile ?? null, baseRadiusKm),
    [filter, profileQuery.data?.profile, baseRadiusKm]
  );

  const applyFilters = useCallback(
    (next: FeedFilterState, nextMood: DiscoveryMood) => {
      setFilter(next);
      setMood(nextMood);
      if (user?.id) {
        const client = createClient();
        void client
          .from('profiles')
          .update({
            preferences: {
              ...(profileQuery.data?.profile?.preferences ?? {}),
              feed_filters: {
                maxDistanceKm: next.maxDistanceKm,
                minPriceCents: next.minPriceCents,
                maxPriceCents: next.maxPriceCents,
                verifiedHostsOnly: next.verifiedHostsOnly,
                hostPresence: next.hostPresence,
                clientFiltersActive: next.clientFiltersActive,
              },
            },
          })
          .eq('user_id', user.id)
          .then(() => void profileQuery.refetch());
      }
    },
    [user?.id, profileQuery]
  );

  const value = useMemo(
    () => ({
      mood,
      filter: activeFilter,
      baseRadiusKm,
      viewerLat,
      viewerLng,
      isPremium,
      profileLoading: profileQuery.isLoading,
      viewerProfile: profileQuery.data?.profile ?? null,
      applyFilters,
    }),
    [
      mood,
      activeFilter,
      baseRadiusKm,
      viewerLat,
      viewerLng,
      isPremium,
      profileQuery.isLoading,
      profileQuery.data?.profile,
      deviceCoords?.lat,
      deviceCoords?.lng,
      applyFilters,
    ]
  );

  return (
    <DiscoverPageContext.Provider value={value}>{children}</DiscoverPageContext.Provider>
  );
}

export function useDiscoverPage() {
  const ctx = useContext(DiscoverPageContext);
  if (!ctx) {
    throw new Error('useDiscoverPage must be used within DiscoverPageProvider');
  }
  return ctx;
}

/** Safe for AppShell rail — returns null outside discover provider. */
export function useDiscoverPageOptional() {
  return useContext(DiscoverPageContext);
}
