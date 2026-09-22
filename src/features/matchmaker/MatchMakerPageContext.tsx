'use client';

import {
  defaultMatchMakerFilter,
  type MatchMakerFilterState,
} from '@/lib/matchmaker/filterState';
import { sliderMaxKmForTier } from '@/lib/plans/discoveryRadius';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type MatchMakerPageContextValue = {
  filter: MatchMakerFilterState;
  baseRadiusKm: number;
  sliderMaxKm: number;
  effectiveTier: SubscriptionTier;
  profileLoading: boolean;
  applyFilter: (next: MatchMakerFilterState) => void;
};

const MatchMakerPageContext = createContext<MatchMakerPageContextValue | null>(null);

export function MatchMakerPageProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<MatchMakerFilterState>(defaultMatchMakerFilter());
  const { subscriptionState } = useSubscriptionContext();

  const profileQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const baseRadiusKm = profileQuery.data?.profile?.radius_km
    ? Number(profileQuery.data.profile.radius_km)
    : 50;
  const effectiveTier = subscriptionState.effectiveTier;
  const sliderMaxKm = sliderMaxKmForTier(effectiveTier);

  const applyFilter = useCallback((next: MatchMakerFilterState) => {
    setFilter(next);
  }, []);

  const value = useMemo(
    () => ({
      filter,
      baseRadiusKm,
      sliderMaxKm,
      effectiveTier,
      profileLoading: profileQuery.isLoading,
      applyFilter,
    }),
    [filter, baseRadiusKm, sliderMaxKm, effectiveTier, profileQuery.isLoading, applyFilter]
  );

  return <MatchMakerPageContext.Provider value={value}>{children}</MatchMakerPageContext.Provider>;
}

export function useMatchMakerPage() {
  const ctx = useContext(MatchMakerPageContext);
  if (!ctx) {
    throw new Error('useMatchMakerPage must be used within MatchMakerPageProvider');
  }
  return ctx;
}

export function useMatchMakerPageOptional() {
  return useContext(MatchMakerPageContext);
}
