'use client';

import { FirstSessionModalQueue } from '@/components/discover/FirstSessionModalQueue';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { PlanCardSkeleton } from '@/components/ui/Skeleton';
import { DiscoverFeedToolbar, type DiscoverViewMode } from '@/features/discover/DiscoverFeedToolbar';
import { DiscoverPlanCard } from '@/features/discover/DiscoverPlanCard';
import { DiscoverPlanListCard } from '@/features/discover/DiscoverPlanListCard';
import { DiscoverLocationPrompt } from '@/features/discover/DiscoverLocationPrompt';
import { DiscoverSwipeSection } from '@/features/discover/DiscoverSwipeSection';
import { MoodPlanDiscoverPill } from '@/features/discover/MoodPlanDiscoverPill';
import { MoodTimelineCarousel } from '@/features/discover/MoodTimelineCarousel';
import { useDiscoverPage } from '@/features/discover/DiscoverPageContext';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { useIsMobileDiscoverLayout } from '@/hooks/use-media-query';
import {
  applyDiscoverFilters,
  loadFeedFilterFromProfile,
  moodTimelinePlans,
  standardDiscoverPlans,
} from '@/lib/discovery/feedFilters';
import { planDistanceFromViewer } from '@/lib/discovery/feedFilters';
import { derivePresenceUi } from '@/lib/presence/hostPresenceStatus';
import { createClient } from '@/lib/supabase/client';
import { fetchPresenceMap } from '@/services/presence.service';
import {
  DISCOVER_PAGE_SIZE,
  fetchDiscoverPlansPage,
  type PlanFeedRow,
} from '@/services/plans.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoEyeOffOutline,
  IoFunnelOutline,
  IoHeart,
  IoHeartOutline,
  IoNavigateOutline,
} from 'react-icons/io5';

const VIEW_STORAGE_KEY = 'linkup_discover_view_mode';

function distanceLabelFor(
  plan: { latitude: number | null; longitude: number | null },
  viewerLat: number | null,
  viewerLng: number | null
): string {
  if (
    viewerLat == null ||
    viewerLng == null ||
    plan.latitude == null ||
    plan.longitude == null
  ) {
    return 'Nearby';
  }
  const d = planDistanceFromViewer(plan, viewerLat, viewerLng);
  if (!Number.isFinite(d)) return 'Nearby';
  return d < 1 ? 'Near you' : `${d.toFixed(1)} km`;
}

function loadStoredView(isMobile: boolean): DiscoverViewMode {
  if (typeof window === 'undefined') return isMobile ? 'swipe' : 'list';
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === 'swipe' || raw === 'grid' || raw === 'list') {
      if (isMobile && raw === 'list') return 'swipe';
      if (!isMobile && raw === 'swipe') return 'list';
      return raw;
    }
  } catch {
    /* ignore */
  }
  return isMobile ? 'swipe' : 'list';
}

export function DiscoverFeed() {
  const user = useAuthStore((s) => s.user);
  const mounted = useHasMounted();
  const isMobileQuery = useIsMobileDiscoverLayout();
  /** SSR + first paint match desktop; mobile layout after mount (avoids hydration mismatch). */
  const isMobileLayout = mounted && isMobileQuery;
  const {
    mood,
    filter: activeFilter,
    baseRadiusKm,
    browseRadiusKm,
    hasWiderRadius,
    effectiveTier,
    viewerLat,
    viewerLng,
    advancedFiltersAllowed,
    viewerProfile,
    isIncognitoActive,
    hiddenPlanIds,
    canUndoSwipe,
    hidePlan,
    undoHiddenPlans,
    requestDeviceLocation,
    hasDeviceLocation,
    applyFilters,
    profileLoading,
  } = useDiscoverPage();
  const { subscriptionState } = useSubscriptionContext();
  const queryClient = useQueryClient();
  const discoverQueryKey = useMemo(() => ['discover', user?.id] as const, [user?.id]);
  const [view, setView] = useState<DiscoverViewMode>('list');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);
  const loadMoreLockRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    setView(loadStoredView(isMobileQuery));
  }, [mounted, isMobileQuery]);

  const setViewPersisted = (next: DiscoverViewMode) => {
    const normalized =
      isMobileLayout && next === 'list' ? 'swipe' : !isMobileLayout && next === 'swipe' ? 'list' : next;
    setView(normalized);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
  };

  const fetchDiscoverPage = useCallback(
    async (pageIndex: number) => {
      const client = createClient();
      const from = pageIndex * DISCOVER_PAGE_SIZE;
      const to = from + DISCOVER_PAGE_SIZE - 1;
      const { data: rows, error: err } = await fetchDiscoverPlansPage(client, from, to, {
        viewerUserId: user?.id ?? null,
        skipClientRank: true,
      });
      if (err) throw new Error(err.message);
      return rows;
    },
    [user?.id]
  );

  const {
    data: feedRows = [],
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: discoverQueryKey,
    queryFn: async () => {
      const generation = ++fetchGenRef.current;
      const rows = await fetchDiscoverPage(0);
      if (generation !== fetchGenRef.current) {
        const cached = queryClient.getQueryData<PlanFeedRow[]>(discoverQueryKey);
        return cached ?? rows;
      }
      setPage(0);
      setHasMore(rows.length >= DISCOVER_PAGE_SIZE);
      return rows;
    },
    enabled: mounted,
    staleTime: 30_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
  });

  const showInitialLoading = isPending && feedRows.length === 0;

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetching || loadMoreLockRef.current || showInitialLoading) return;
    loadMoreLockRef.current = true;
    const generation = fetchGenRef.current;
    const next = page + 1;
    try {
      const rows = await fetchDiscoverPage(next);
      if (generation !== fetchGenRef.current) return;
      setHasMore(rows.length >= DISCOVER_PAGE_SIZE);
      queryClient.setQueryData<PlanFeedRow[]>(discoverQueryKey, (prev) => {
        const base = prev ?? [];
        const seen = new Set(base.map((p) => p.id));
        const merged = [...base];
        for (const row of rows) {
          if (!seen.has(row.id)) merged.push(row);
        }
        return merged;
      });
      setPage(next);
    } finally {
      loadMoreLockRef.current = false;
    }
  }, [
    hasMore,
    isFetching,
    page,
    fetchDiscoverPage,
    showInitialLoading,
    queryClient,
    discoverQueryKey,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasMore && !isFetching && !showInitialLoading) {
          void loadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetching, showInitialLoading, loadMore]);

  useEffect(() => {
    if (!user?.id) return;
    const client = createClient();
    const channel = client
      .channel(`discover-plans-status:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans' },
        (payload) => {
          const updated = payload.new as {
            id?: string;
            status?: string;
            is_suppressed?: boolean;
            archived_at?: string | null;
          };
          if (!updated?.id) return;
          const remove =
            updated.is_suppressed === true ||
            (updated.archived_at != null && updated.archived_at !== '') ||
            (updated.status != null &&
              ['agreed', 'active', 'completed', 'cancelled'].includes(updated.status));
          if (remove) {
            queryClient.setQueryData<PlanFeedRow[]>(discoverQueryKey, (prev) =>
              (prev ?? []).filter((p) => p.id !== updated.id)
            );
          } else {
            void queryClient.invalidateQueries({ queryKey: discoverQueryKey });
          }
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id, queryClient, discoverQueryKey]);

  const preFiltered = useMemo(() => {
    return applyDiscoverFilters(feedRows, {
      mood,
      filter: activeFilter,
      viewerId: user?.id,
      viewerLat,
      viewerLng,
      baseRadiusKm,
      browseRadiusKm,
      viewerProfile,
      effectiveTier: subscriptionState.effectiveTier,
      hiddenPlanIds,
    });
  }, [
    feedRows,
    mood,
    activeFilter,
    user?.id,
    viewerLat,
    viewerLng,
    baseRadiusKm,
    browseRadiusKm,
    viewerProfile,
    subscriptionState.effectiveTier,
    hiddenPlanIds,
  ]);

  const creatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of preFiltered) {
      if (user?.id && r.creator_id === user.id) continue;
      ids.add(r.creator_id);
    }
    return [...ids];
  }, [preFiltered, user?.id]);

  const presenceKey = creatorIds.join('|');

  const { data: presenceByUser = {} } = useQuery({
    queryKey: ['discover-presence', presenceKey],
    queryFn: () => fetchPresenceMap(creatorIds),
    enabled: creatorIds.length > 0,
    staleTime: 30_000,
  });

  const filteredWithPresence = useMemo(() => {
    if (activeFilter.hostPresence === 'all') return preFiltered;
    return applyDiscoverFilters(preFiltered, {
      mood,
      filter: activeFilter,
      viewerId: user?.id,
      viewerLat,
      viewerLng,
      baseRadiusKm,
      browseRadiusKm,
      viewerProfile,
      presenceByUser,
      effectiveTier: subscriptionState.effectiveTier,
      hiddenPlanIds,
    });
  }, [
    preFiltered,
    activeFilter,
    mood,
    user?.id,
    viewerLat,
    viewerLng,
    baseRadiusKm,
    browseRadiusKm,
    viewerProfile,
    presenceByUser,
    subscriptionState.effectiveTier,
    hiddenPlanIds,
  ]);

  const moodRows = useMemo(() => moodTimelinePlans(filteredWithPresence), [filteredWithPresence]);
  const standardRows = useMemo(() => standardDiscoverPlans(filteredWithPresence), [filteredWithPresence]);

  const filterKey = `${mood}-${activeFilter.clientFiltersActive}-${activeFilter.maxDistanceKm}`;

  const presenceFor = (creatorId: string, creator: PlanFeedRow['creator']) =>
    derivePresenceUi(
      viewerProfile,
      creator?.preferences,
      presenceByUser[creatorId] ?? null,
      !!creator?.masked_activity_enabled
    );

  const distanceForPlan = (plan: PlanFeedRow) => distanceLabelFor(plan, viewerLat, viewerLng);

  const effectiveView = isMobileLayout && view === 'list' ? 'swipe' : view;

  const feedContent = (
    <>
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
          {error instanceof Error
            ? error.message
            : 'Could not load plans. Confirm Supabase env vars and RLS access.'}
          <button
            type="button"
            className="ml-2 font-extrabold text-primary underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {showInitialLoading ? (
        <div
          className={cn(
            effectiveView === 'grid'
              ? 'grid gap-5 sm:grid-cols-2'
              : effectiveView === 'swipe'
                ? 'mx-auto flex min-h-0 flex-1 max-w-md flex-col'
                : 'space-y-4',
            isMobileLayout && effectiveView === 'swipe' && 'flex-1'
          )}
        >
          {effectiveView === 'swipe' ? (
            <div className="min-h-[300px] flex-1 animate-pulse rounded-[28px] bg-[#EDE8FF]/80" />
          ) : (
            Array.from({ length: 4 }).map((_, i) => <PlanCardSkeleton key={i} />)
          )}
        </div>
      ) : filteredWithPresence.length === 0 && !showInitialLoading && !error ? (
        <AppEmptyState
          emoji="🔍"
          title="Nothing matches right now"
          titleAccent="matches"
          description="Widen your radius, clear price filters, or switch mood — fresh plans sync from the same feed as the LinkUp app."
          tips={[
            {
              icon: IoFunnelOutline,
              text: 'Tap the filter icon beside the view toggle to widen radius or change vibe',
            },
            {
              icon: IoNavigateOutline,
              text: 'Turn on travel mode in profile if you’re browsing away from home',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
            {
              icon: IoHeartOutline,
              text: 'Host a meetup — mood moments show up near you when hosts are free now',
              iconBgClassName: 'bg-emerald-500/10',
              iconClassName: 'text-emerald-600',
            },
          ]}
          action={{
            label: 'Reset filters',
            onClick: () =>
              applyFilters(loadFeedFilterFromProfile(viewerProfile, baseRadiusKm), 'all'),
          }}
          secondaryAction={{ label: 'Create a plan', href: '/plan/create', variant: 'secondary' }}
        />
      ) : effectiveView === 'swipe' ? (
        <DiscoverSwipeSection
          plans={standardRows}
          moodCount={moodRows.length}
          presenceFor={presenceFor}
          distanceLabelFor={distanceForPlan}
          filterKey={filterKey}
          onHidePlan={hidePlan}
          onUndoHidden={undoHiddenPlans}
          canUndoSwipe={canUndoSwipe}
        />
      ) : effectiveView === 'list' ? (
        <ul className="flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
          {filteredWithPresence.map((plan) => (
            <li key={plan.id}>
              {plan.is_mood_plan && plan.mood_expires_at ? (
                <MoodPlanDiscoverPill plan={plan} viewerUserId={user?.id} />
              ) : (
                <DiscoverPlanListCard
                  plan={plan}
                  distanceLabel={distanceForPlan(plan)}
                  presence={presenceFor(plan.creator_id, plan.creator)}
                  viewerProfile={viewerProfile}
                  viewerUserId={user?.id}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-3 min-[400px]:gap-5 sm:grid-cols-2',
            isMobileLayout && 'pb-[var(--linkup-tab-clearance)]',
            !isMobileLayout && 'pb-0'
          )}
        >
          {filteredWithPresence.map((plan) =>
            plan.is_mood_plan && plan.mood_expires_at ? (
              <MoodPlanDiscoverPill key={plan.id} plan={plan} viewerUserId={user?.id} />
            ) : (
              <DiscoverPlanCard
                key={plan.id}
                plan={plan}
                presence={presenceFor(plan.creator_id, plan.creator)}
                viewerProfile={viewerProfile}
                viewerUserId={user?.id}
                distanceLabel={distanceForPlan(plan)}
              />
            )
          )}
        </div>
      )}

      {isFetching && !showInitialLoading ? (
        <p className="text-center text-[12px] font-semibold text-muted">Refreshing feed…</p>
      ) : null}
      <div ref={sentinelRef} className="h-4 shrink-0" aria-hidden />
    </>
  );

  return (
    <div
      className={cn(
        'min-w-0',
        isMobileLayout
          ? 'flex h-full min-h-0 flex-col gap-2'
          : 'space-y-4 pb-10 min-[360px]:space-y-6 min-[400px]:space-y-8 lg:space-y-8 lg:pb-10'
      )}
    >
      <TabPageHeader
        kicker="Discover"
        title="Meetups worth showing up for"
        icon={<IoHeart size={22} />}
        trailing={
          isIncognitoActive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-[#F5F6FA] px-2 py-0.5 text-[11px] font-extrabold text-muted">
              <IoEyeOffOutline size={12} />
              Incognito
            </span>
          ) : null
        }
        className={isMobileLayout ? '!gap-2 shrink-0' : undefined}
      />

      <DiscoverLocationPrompt
        onRequestLocation={requestDeviceLocation}
        hasDeviceLocation={hasDeviceLocation}
        className={cn(isMobileLayout ? 'shrink-0' : undefined)}
      />

      <MoodTimelineCarousel
        plans={moodRows}
        viewerUserId={user?.id}
        className={cn(isMobileLayout && 'shrink-0 !space-y-2')}
      />

      {isMobileLayout ? (
        <section
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-2',
            effectiveView === 'grid' && 'overflow-y-auto overscroll-y-contain'
          )}
        >
          <div className="shrink-0">
            <DiscoverFeedToolbar
              planCount={filteredWithPresence.length}
              moodCount={moodRows.length}
              filtersActive={activeFilter.clientFiltersActive}
              filter={activeFilter}
              mood={mood}
              baseRadiusKm={baseRadiusKm}
              browseRadiusKm={browseRadiusKm}
              hasWiderRadius={hasWiderRadius}
              effectiveTier={effectiveTier}
              advancedFiltersAllowed={advancedFiltersAllowed}
              profileLoading={profileLoading}
              onApply={applyFilters}
              view={effectiveView}
              onViewChange={setViewPersisted}
              isMobileLayout={isMobileLayout}
            />
          </div>
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col',
              effectiveView === 'swipe' && 'overflow-hidden',
              effectiveView === 'grid' && 'min-h-0'
            )}
          >
            {feedContent}
          </div>
        </section>
      ) : (
        <>
          <DiscoverFeedToolbar
            planCount={filteredWithPresence.length}
            moodCount={moodRows.length}
            filtersActive={activeFilter.clientFiltersActive}
            filter={activeFilter}
            mood={mood}
            baseRadiusKm={baseRadiusKm}
            browseRadiusKm={browseRadiusKm}
            hasWiderRadius={hasWiderRadius}
            effectiveTier={effectiveTier}
            advancedFiltersAllowed={advancedFiltersAllowed}
            profileLoading={profileLoading}
            onApply={applyFilters}
            view={effectiveView}
            onViewChange={setViewPersisted}
            isMobileLayout={isMobileLayout}
          />
          {feedContent}
        </>
      )}
      <FirstSessionModalQueue />
    </div>
  );
}
