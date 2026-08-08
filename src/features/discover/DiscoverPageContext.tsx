'use client';

import { loadFeedFilterFromProfile, type FeedFilterState } from '@/lib/discovery/feedFilters';
import { isDiscoverFilterConstraintActive } from '@/lib/discovery/parseStoredFeedFilters';
import { consumePendingMeetTypeFilter } from '@/lib/discovery/pendingMeetTypeFilter';
import { resolveDiscoverViewerCoords } from '@/lib/discovery/viewerLocation';
import { usePermission } from '@/hooks/usePermission';
import { fetchHiddenPlanIds, persistHiddenPlan, removeHiddenPlan } from '@/lib/plans/hiddenPlans';
import { clampMaxDistanceKm, sliderMaxKmForTier } from '@/lib/plans/discoveryRadius';
import { tierRank } from '@/lib/subscription/constants';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { useViewerGeolocation } from '@/hooks/use-viewer-geolocation';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import type { DbProfile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type MeetTypeFilter = { id: string; name: string };

type DiscoverPageContextValue = {
  mood: DiscoveryMood;
  filter: FeedFilterState;
  meetTypeFilter: MeetTypeFilter | null;
  baseRadiusKm: number;
  /** Profile default radius — no tier multiplier. */
  browseRadiusKm: number;
  sliderMaxKm: number;
  hasWiderRadius: boolean;
  effectiveTier: SubscriptionTier;
  viewerLat: number | null;
  viewerLng: number | null;
  advancedFiltersAllowed: boolean;
  travelModeAllowed: boolean;
  profileLoading: boolean;
  viewerProfile: DbProfile | null;
  isIncognitoActive: boolean;
  hiddenPlanIds: Set<string>;
  canUndoSwipe: boolean;
  hidePlan: (planId: string) => void;
  undoHiddenPlans: () => void;
  requestDeviceLocation: () => void;
  hasDeviceLocation: boolean;
  applyFilters: (next: FeedFilterState, nextMood: DiscoveryMood) => void;
  clearMeetTypeFilter: () => void;
  clearTravelMode: () => Promise<void>;
  isTravelModeActive: boolean;
  travelCityLabel: string | null;
  isTravelModeStale: boolean;
};

const DiscoverPageContext = createContext<DiscoverPageContextValue | null>(null);

const TRAVEL_STALE_DAYS = 7;

export function DiscoverPageProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [mood, setMood] = useState<DiscoveryMood>('all');
  const [filter, setFilter] = useState<FeedFilterState | null>(null);
  const [meetTypeFilter, setMeetTypeFilter] = useState<MeetTypeFilter | null>(null);
  const [hiddenPlanIds, setHiddenPlanIds] = useState<Set<string>>(() => new Set());
  const [geoTick, setGeoTick] = useState(0);

  const profileQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
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
  const { subscriptionState } = useSubscriptionContext();
  const { allowed: permissionAdvancedFilters } = usePermission('discover.advanced_filters');
  const advancedFiltersAllowed =
    tierRank(subscriptionState.effectiveTier) >= tierRank('SILVER') || permissionAdvancedFilters;
  const { allowed: travelModeAllowed } = usePermission('discover.travel_mode');
  const { allowed: canUndoSwipe } = usePermission('discover.undo_swipe');
  const { allowed: hasWiderRadius, effectiveTier: widerRadiusTier } = usePermission(
    'discover.wider_radius'
  );
  const effectiveTier = (widerRadiusTier ?? subscriptionState.effectiveTier) as SubscriptionTier;
  const sliderMaxKm = sliderMaxKmForTier(effectiveTier);
  const browseRadiusKm = baseRadiusKm;

  const deviceCoords = useViewerGeolocation(!!user?.id || geoTick > 0, geoTick);
  const viewerCoords = resolveDiscoverViewerCoords(
    profileQuery.data?.profile ?? null,
    travelModeAllowed,
    deviceCoords
  );
  const viewerLat = viewerCoords.lat;
  const viewerLng = viewerCoords.lng;

  useEffect(() => {
    const pending = consumePendingMeetTypeFilter();
    if (pending) setMeetTypeFilter(pending);
  }, []);

  useEffect(() => {
    if (filter == null && profileQuery.data?.profile) {
      setFilter(loadFeedFilterFromProfile(profileQuery.data.profile, baseRadiusKm, sliderMaxKm));
    }
  }, [filter, profileQuery.data?.profile, baseRadiusKm, sliderMaxKm]);

  useEffect(() => {
    setFilter((current) => {
      if (!current || current.maxDistanceKm == null) return current;
      const clamped = clampMaxDistanceKm(current.maxDistanceKm, effectiveTier);
      if (clamped === current.maxDistanceKm) return current;
      return { ...current, maxDistanceKm: clamped };
    });
  }, [effectiveTier]);

  useEffect(() => {
    if (!user?.id || !canUndoSwipe) return;
    const client = createClient();
    void fetchHiddenPlanIds(client, user.id).then((ids) => {
      if (ids.length > 0) setHiddenPlanIds(new Set(ids));
    });
  }, [user?.id, canUndoSwipe]);

  const isIncognitoActive =
    subscriptionState.effectiveTier === 'PLATINUM' &&
    !!(profileQuery.data?.profile?.incognito_browse_enabled ??
      profileQuery.data?.profile?.preferences?.incognito_browse);

  const hidePlan = useCallback(
    (planId: string) => {
      setHiddenPlanIds((prev) => {
        const next = new Set(prev);
        next.add(planId);
        return next;
      });
      if (user?.id && canUndoSwipe) {
        persistHiddenPlan(createClient(), user.id, planId);
      }
    },
    [user?.id, canUndoSwipe]
  );

  const undoHiddenPlans = useCallback(() => {
    const ids = [...hiddenPlanIds];
    setHiddenPlanIds(new Set());
    if (user?.id && canUndoSwipe) {
      const client = createClient();
      for (const id of ids) removeHiddenPlan(client, user.id, id);
    }
  }, [hiddenPlanIds, user?.id, canUndoSwipe]);

  const requestDeviceLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setGeoTick((t) => t + 1),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 }
    );
  }, []);

  const activeFilter = useMemo(() => {
    const loaded =
      filter ?? loadFeedFilterFromProfile(profileQuery.data?.profile ?? null, baseRadiusKm, sliderMaxKm);
    const clientFiltersActive =
      loaded.clientFiltersActive || isDiscoverFilterConstraintActive(loaded);
    if (loaded.clientFiltersActive === clientFiltersActive) return loaded;
    return { ...loaded, clientFiltersActive };
  }, [filter, profileQuery.data?.profile, baseRadiusKm, sliderMaxKm]);

  const clearMeetTypeFilter = useCallback(() => setMeetTypeFilter(null), []);

  const isTravelModeActive =
    travelModeAllowed &&
    !!(profileQuery.data?.profile?.preferences?.travel_mode?.label?.trim());

  const travelCityLabel = isTravelModeActive
    ? (profileQuery.data?.profile?.preferences?.travel_mode?.label ?? null)
    : null;

  const isTravelModeStale = useMemo(() => {
    const setAt = profileQuery.data?.profile?.preferences?.travel_mode?.set_at;
    if (!setAt) return false;
    const diffMs = Date.now() - new Date(setAt).getTime();
    return diffMs > TRAVEL_STALE_DAYS * 24 * 60 * 60 * 1000;
  }, [profileQuery.data?.profile?.preferences?.travel_mode]);

  const clearTravelMode = useCallback(async () => {
    if (!user?.id) return;
    const client = createClient();
    const prefs = {
      ...(profileQuery.data?.profile?.preferences ?? {}),
      travel_mode: null,
    };
    await client.from('profiles').update({ preferences: prefs }).eq('user_id', user.id);
    await Promise.all([
      profileQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['discover'] }),
    ]);
  }, [user?.id, profileQuery, queryClient]);

  const applyFilters = useCallback(
    (next: FeedFilterState, nextMood: DiscoveryMood) => {
      const maxDistanceKm = clampMaxDistanceKm(next.maxDistanceKm, effectiveTier);
      const draft = { ...next, maxDistanceKm };
      const clamped: FeedFilterState = {
        ...draft,
        clientFiltersActive:
          next.clientFiltersActive || isDiscoverFilterConstraintActive(draft),
      };
      setFilter(clamped);
      setMood(nextMood);
      if (user?.id) {
        const client = createClient();
        const persisted = {
          maxDistanceKm: null,
          minPriceCents: clamped.minPriceCents,
          maxPriceCents: clamped.maxPriceCents,
          verifiedHostsOnly: clamped.verifiedHostsOnly,
          hostPresence: clamped.hostPresence,
          clientFiltersActive:
            clamped.clientFiltersActive ||
            isDiscoverFilterConstraintActive({
              ...clamped,
              maxDistanceKm: null,
            }),
        };
        void client
          .from('profiles')
          .update({
            preferences: {
              ...(profileQuery.data?.profile?.preferences ?? {}),
              feed_filters: persisted,
            },
          })
          .eq('user_id', user.id)
          .then(() => void profileQuery.refetch());
      }
    },
    [user?.id, profileQuery, effectiveTier]
  );

  const value = useMemo(
    () => ({
      mood,
      filter: activeFilter,
      meetTypeFilter,
      baseRadiusKm,
      browseRadiusKm,
      sliderMaxKm,
      hasWiderRadius,
      effectiveTier,
      viewerLat,
      viewerLng,
      advancedFiltersAllowed,
      travelModeAllowed,
      profileLoading: profileQuery.isLoading,
      viewerProfile: profileQuery.data?.profile ?? null,
      isIncognitoActive,
      hiddenPlanIds,
      canUndoSwipe,
      hidePlan,
      undoHiddenPlans,
      requestDeviceLocation,
      hasDeviceLocation: deviceCoords != null,
      applyFilters,
      clearMeetTypeFilter,
      clearTravelMode,
      isTravelModeActive,
      travelCityLabel,
      isTravelModeStale,
    }),
    [
      mood,
      activeFilter,
      meetTypeFilter,
      baseRadiusKm,
      browseRadiusKm,
      sliderMaxKm,
      hasWiderRadius,
      effectiveTier,
      viewerLat,
      viewerLng,
      advancedFiltersAllowed,
      travelModeAllowed,
      profileQuery.isLoading,
      profileQuery.data?.profile,
      deviceCoords,
      isIncognitoActive,
      hiddenPlanIds,
      canUndoSwipe,
      hidePlan,
      undoHiddenPlans,
      requestDeviceLocation,
      applyFilters,
      clearMeetTypeFilter,
      clearTravelMode,
      isTravelModeActive,
      travelCityLabel,
      isTravelModeStale,
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
