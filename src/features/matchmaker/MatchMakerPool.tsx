'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { DiscoverFilterIconButton } from '@/features/discover/DiscoverMobileFilterBar';
import { MatchMakerFilterSheet } from '@/features/matchmaker/MatchMakerFilterSheet';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPoolCard } from '@/features/matchmaker/MatchMakerPoolCard';
import { MatchMakerPoolEmptyState } from '@/features/matchmaker/MatchMakerPoolEmptyState';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { defaultMatchMakerFilter, type MatchMakerFilterState } from '@/lib/matchmaker/filterState';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { expressMatchMakerInterest, fetchMatchMakerPool } from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export function MatchMakerPool() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { subscriptionState } = useSubscriptionContext();
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<MatchMakerFilterState>(defaultMatchMakerFilter());

  const viewerQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const baseRadiusKm = viewerQuery.data?.profile?.radius_km
    ? Number(viewerQuery.data.profile.radius_km)
    : 50;
  const effectiveTier = subscriptionState.effectiveTier;

  const poolQuery = useQuery({
    queryKey: ['matchmaker-pool', user?.id, filter.maxDistanceKm, filter.sortBy],
    queryFn: async () => {
      const client = createClient();
      const result = await fetchMatchMakerPool(client, 12, {
        maxDistanceKm: filter.maxDistanceKm,
        sortBy: filter.sortBy,
      });
      if (result.error) throw new Error(result.error);
      return result;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: (prev) => prev,
  });

  const cards = poolQuery.data?.data ?? [];
  const emptyReason = poolQuery.data?.emptyReason ?? null;
  const current = cards[index] ?? null;
  const poolCount = cards.length;

  useEffect(() => {
    setIndex(0);
  }, [filter.maxDistanceKm, filter.sortBy]);

  const signals = useMemo(() => {
    if (!current || !viewerQuery.data?.profile) return [];
    return buildCompatibilitySignals(
      {
        communication_style: viewerQuery.data.profile.communication_style,
        preferences: viewerQuery.data.profile.preferences,
      },
      current
    );
  }, [current, viewerQuery.data?.profile]);

  const expressMutation = useMutation({
    mutationFn: async (toUserId: string) => {
      const client = createClient();
      const result = await expressMatchMakerInterest(client, toUserId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      if (result.matched && result.connectionId) {
        router.push(`/matchmaker/connection/${result.connectionId}`);
        return;
      }
      setToast('Interest sent');
      setTimeout(() => setToast(null), 2000);
      setIndex((i) => i + 1);
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
    },
  });

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <TabPageHeader
          kicker="MatchMaker"
          title="Your pool"
          description="One connection at a time. Take your time."
          icon={<MatchMakerTabIcon size={22} />}
        />

        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-muted min-[360px]:text-[11px] sm:text-[12px]">
            {poolCount} member{poolCount === 1 ? '' : 's'} in your pool
            {filter.filterActive ? ' · filtered' : ''}
          </p>
          <DiscoverFilterIconButton active={filter.filterActive} onClick={() => setFilterOpen(true)} />
        </div>

        {poolQuery.isLoading && !poolQuery.data ? (
          <div className="mt-6 flex flex-col items-center gap-4 px-6 py-10">
            <div className="h-[118px] w-[118px] animate-pulse rounded-full bg-[#EDE0D4]" />
            <div className="h-5 w-48 animate-pulse rounded-full bg-[#EDE0D4]" />
            <div className="h-4 w-64 animate-pulse rounded-full bg-[#EDE0D4]" />
            <div className="h-4 w-56 animate-pulse rounded-full bg-[#EDE0D4]" />
          </div>
        ) : null}

        {!poolQuery.isLoading && !current ? (
          <MatchMakerPoolEmptyState reason={emptyReason} className="mt-6" />
        ) : null}

        {current ? (
          <div className="mt-6">
            <MatchMakerPoolCard
              profile={current}
              signals={signals}
              onPass={() => setIndex((i) => i + 1)}
              onExpressInterest={() => expressMutation.mutate(current.user_id)}
              expressBusy={expressMutation.isPending}
            />
          </div>
        ) : null}

        <MatchMakerFilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filter={filter}
          baseRadiusKm={baseRadiusKm}
          effectiveTier={effectiveTier}
          onApply={(next) => {
            setFilter(next);
            void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
          }}
        />

        {toast ? (
          <div
            className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold text-white shadow-lg"
            style={{ background: MATCHMAKER_THEME.accent }}
          >
            <MatchMakerTabIcon size={16} className="text-white" />
            {toast}
          </div>
        ) : null}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
