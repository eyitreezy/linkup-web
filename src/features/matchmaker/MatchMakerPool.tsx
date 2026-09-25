'use client';

import { ListGridViewToggle, type ListGridViewMode } from '@/components/feed/ListGridViewToggle';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { DiscoverFilterIconButton } from '@/features/discover/DiscoverMobileFilterBar';
import { MatchMakerFilterSheet } from '@/features/matchmaker/MatchMakerFilterSheet';
import { useMatchMakerPage } from '@/features/matchmaker/MatchMakerPageContext';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPoolEmptyState } from '@/features/matchmaker/MatchMakerPoolEmptyState';
import { MatchMakerPoolFeedSkeleton } from '@/features/matchmaker/MatchMakerPoolCardSkeleton';
import { MatchMakerPoolGridCard } from '@/features/matchmaker/MatchMakerPoolGridCard';
import { MatchMakerPoolListCard } from '@/features/matchmaker/MatchMakerPoolListCard';
import { useMatchMakerInterestBadge } from '@/hooks/useMatchMakerInterestBadge';
import { useMatchMakerInterestRealtime } from '@/hooks/useMatchMakerInterestRealtime';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { matchmakerInterestsHref } from '@/lib/matchmaker/routes';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import {
  expressMatchMakerInterest,
  fetchMatchMakerPool,
  passMatchMakerPoolProfile,
} from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { IoHeart } from 'react-icons/io5';

const VIEW_STORAGE_KEY = 'linkup_matchmaker_pool_view_mode';

function loadStoredView(): ListGridViewMode {
  if (typeof window === 'undefined') return 'list';
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === 'list' || raw === 'grid') return raw;
  } catch {
    /* ignore */
  }
  return 'list';
}

export function MatchMakerPool() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { filter, baseRadiusKm, sliderMaxKm, effectiveTier, applyFilter } = useMatchMakerPage();
  const [view, setView] = useState<ListGridViewMode>(() => loadStoredView());
  const [expressingUserId, setExpressingUserId] = useState<string | null>(null);
  const [passingUserId, setPassingUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const receivedInterestCount = useMatchMakerInterestBadge(user?.id);

  useMatchMakerInterestRealtime(user?.id);

  const setViewPersisted = useCallback((next: ListGridViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const viewerQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

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
  const poolCount = cards.length;

  const signalsByUserId = useMemo(() => {
    const viewer = viewerQuery.data?.profile;
    if (!viewer) return {};
    return Object.fromEntries(
      cards.map((card) => [
        card.user_id,
        buildCompatibilitySignals(
          {
            communication_style: viewer.communication_style,
            preferences: viewer.preferences,
          },
          card
        ),
      ])
    );
  }, [cards, viewerQuery.data?.profile]);

  const passMutation = useMutation({
    mutationFn: async (toUserId: string) => {
      setPassingUserId(toUserId);
      const client = createClient();
      const result = await passMatchMakerPoolProfile(client, toUserId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setPassingUserId(null);
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-member-interaction'] });
    },
    onError: () => setPassingUserId(null),
  });

  const expressMutation = useMutation({
    mutationFn: async (toUserId: string) => {
      setExpressingUserId(toUserId);
      const client = createClient();
      const result = await expressMatchMakerInterest(client, toUserId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result, toUserId) => {
      setExpressingUserId(null);
      if (result.matched && result.connectionId) {
        router.push(`/matchmaker/connection/${result.connectionId}`);
        return;
      }
      if (result.alreadySent) {
        setToast('You already expressed interest in this member');
        setTimeout(() => setToast(null), 2200);
      } else if (!result.queued) {
        setToast('Interest sent');
        setTimeout(() => setToast(null), 2000);
      }
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-badge'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-member-interaction', toUserId] });
    },
    onError: () => {
      setExpressingUserId(null);
    },
  });

  const showInitialLoading = poolQuery.isLoading && !poolQuery.data;
  const showEmpty = !showInitialLoading && cards.length === 0;

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
            {filter.filterActive ? ', filtered' : ''}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={matchmakerInterestsHref()}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border transition hover:opacity-95 active:scale-[0.98]"
              style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
              aria-label={
                receivedInterestCount > 0
                  ? `People who expressed interest, ${receivedInterestCount} unopened`
                  : 'People who expressed interest'
              }
            >
              <IoHeart size={18} style={{ color: MATCHMAKER_THEME.accent }} />
              {receivedInterestCount > 0 ? (
                <span
                  className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold tabular-nums text-white"
                  style={{ background: MATCHMAKER_THEME.accent }}
                >
                  {receivedInterestCount > 99 ? '99+' : receivedInterestCount}
                </span>
              ) : null}
            </Link>
            <div className="xl:hidden">
              <DiscoverFilterIconButton active={filter.filterActive} onClick={() => setFilterOpen(true)} />
            </div>
            <ListGridViewToggle view={view} onViewChange={setViewPersisted} />
          </div>
        </div>

        {showInitialLoading ? <MatchMakerPoolFeedSkeleton view={view} className="mt-4" /> : null}

        {showEmpty ? <MatchMakerPoolEmptyState reason={emptyReason} className="mt-6" /> : null}

        {!showInitialLoading && cards.length > 0 ? (
          view === 'list' ? (
            <ul className="mt-4 flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
              {cards.map((profile) => (
                <li key={profile.user_id}>
                  <MatchMakerPoolListCard
                    profile={profile}
                    signals={signalsByUserId[profile.user_id] ?? []}
                    onPass={() => passMutation.mutate(profile.user_id)}
                    onExpressInterest={() => expressMutation.mutate(profile.user_id)}
                    expressBusy={
                      (expressingUserId === profile.user_id && expressMutation.isPending) ||
                      (passingUserId === profile.user_id && passMutation.isPending)
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className={cn('mt-4 grid grid-cols-1 gap-3 min-[400px]:gap-5 sm:grid-cols-2')}>
              {cards.map((profile) => (
                <MatchMakerPoolGridCard
                  key={profile.user_id}
                  profile={profile}
                  signals={signalsByUserId[profile.user_id] ?? []}
                  onPass={() => passMutation.mutate(profile.user_id)}
                  onExpressInterest={() => expressMutation.mutate(profile.user_id)}
                  expressBusy={
                    (expressingUserId === profile.user_id && expressMutation.isPending) ||
                    (passingUserId === profile.user_id && passMutation.isPending)
                  }
                />
              ))}
            </div>
          )
        ) : null}

        <MatchMakerFilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filter={filter}
          baseRadiusKm={baseRadiusKm}
          sliderMaxKm={sliderMaxKm}
          effectiveTier={effectiveTier}
          onApply={applyFilter}
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
