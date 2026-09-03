'use client';

import { MoodPlanPushPrompt } from '@/components/notifications/MoodPlanPushPrompt';
import { FirstSessionModalQueue } from '@/components/discover/FirstSessionModalQueue';
import { TravelModeBanner } from '@/components/discover/TravelModeBanner';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppPagination } from '@/components/ui/AppPagination';
import { PlanCardSkeleton } from '@/components/ui/Skeleton';
import { DiscoverFeedToolbar, type DiscoverViewMode } from '@/features/discover/DiscoverFeedToolbar';
import { DiscoverPlanCard } from '@/features/discover/DiscoverPlanCard';
import { DiscoverPlanListCard } from '@/features/discover/DiscoverPlanListCard';
import { DiscoverLocationPrompt } from '@/features/discover/DiscoverLocationPrompt';
import { DiscoverSwipeSection } from '@/features/discover/DiscoverSwipeSection';
import { MeetTypeDiscoverPill } from '@/features/discover/MeetTypeDiscoverPill';
import { MoodPlanDiscoverPill } from '@/features/discover/MoodPlanDiscoverPill';
import { MoodTimelineCarousel } from '@/features/discover/MoodTimelineCarousel';
import { useDiscoverPage } from '@/features/discover/DiscoverPageContext';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { useDiscoverPlansRealtime } from '@/hooks/useDiscoverPlansRealtime';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { useIsMobileDiscoverLayout } from '@/hooks/use-media-query';
import {
  applyDiscoverFilters,
  hasDiscoverPriceFilter,
  loadFeedFilterFromProfile,
  moodTimelinePlans,
  standardDiscoverPlans,
} from '@/lib/discovery/feedFilters';
import { planDistanceFromViewer } from '@/lib/discovery/feedFilters';
import { formatPlanDistanceLabel, planHasMeetupCoords } from '@/lib/plans/planDistanceLabel';
import { derivePresenceUi } from '@/lib/presence/hostPresenceStatus';
import { createClient } from '@/lib/supabase/client';
import { fetchPresenceMap } from '@/services/presence.service';
import {
  DISCOVER_PAGE_SIZE,
  fetchDiscoverPlansPage,
  fetchViewerMatchedStandardPlanIds,
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
  IoAirplane,
} from 'react-icons/io5';

const VIEW_STORAGE_KEY = 'linkup_discover_view_mode';
const UI_PAGE_SIZE = 15;

function distanceLabelFor(
  plan: Pick<PlanFeedRow, 'meetup_latitude' | 'meetup_longitude' | 'latitude' | 'longitude'>,
  viewerLat: number | null,
  viewerLng: number | null,
  style: 'pill' | 'line' = 'pill'
): string {
  const viewerHasLocation = viewerLat != null && viewerLng != null;
  const planHasLocation = planHasMeetupCoords(plan);
  let distanceKm: number | null = null;
  if (viewerHasLocation && planHasLocation) {
    const d = planDistanceFromViewer(plan, viewerLat, viewerLng);
    distanceKm = Number.isFinite(d) ? d : null;
  }
  return formatPlanDistanceLabel({
    distanceKm,
    viewerHasLocation,
    planHasLocation,
    style,
  });
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
    meetTypeFilter,
    baseRadiusKm,
    sliderMaxKm,
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
    clearMeetTypeFilter,
    clearTravelMode,
    isTravelModeActive,
    travelCityLabel,
    isTravelModeStale,
    profileLoading,
  } = useDiscoverPage();
  const { subscriptionState } = useSubscriptionContext();
  const queryClient = useQueryClient();
  const priceQueryFilter = useMemo(
    () => ({
      minPriceCents: activeFilter.minPriceCents,
      maxPriceCents: activeFilter.maxPriceCents,
    }),
    [activeFilter.minPriceCents, activeFilter.maxPriceCents]
  );
  const discoverQueryKey = useMemo(
    () =>
      [
        'discover',
        user?.id,
        priceQueryFilter.minPriceCents ?? 'min',
        priceQueryFilter.maxPriceCents ?? 'max',
      ] as const,
    [user?.id, priceQueryFilter.minPriceCents, priceQueryFilter.maxPriceCents]
  );
  const [view, setView] = useState<DiscoverViewMode>('list');
  const [page, setPage] = useState(0);
  const [uiPage, setUiPage] = useState(0);
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

  useEffect(() => {
    setPage(0);
    setUiPage(0);
    setHasMore(true);
    fetchGenRef.current += 1;
  }, [activeFilter.minPriceCents, activeFilter.maxPriceCents]);

  const fetchDiscoverPage = useCallback(
    async (pageIndex: number) => {
      const client = createClient();
      const from = pageIndex * DISCOVER_PAGE_SIZE;
      const to = from + DISCOVER_PAGE_SIZE - 1;
      const { data: rows, error: err } = await fetchDiscoverPlansPage(client, from, to, {
        viewerUserId: user?.id ?? null,
        skipClientRank: true,
        priceFilter: hasDiscoverPriceFilter(priceQueryFilter) ? priceQueryFilter : null,
      });
      if (err) throw new Error(err.message);
      return rows;
    },
    [user?.id, priceQueryFilter]
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
    refetchOnWindowFocus: false,
  });

  useDiscoverPlansRealtime(user?.id, discoverQueryKey);

  const { data: viewerMatchedPlanIds = [] } = useQuery({
    queryKey: ['discover-matched-plan-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const client = createClient();
      return fetchViewerMatchedStandardPlanIds(client, user.id);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const viewerMatchedPlanIdSet = useMemo(
    () => new Set(viewerMatchedPlanIds),
    [viewerMatchedPlanIds]
  );

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

  const preFiltered = useMemo(() => {
    return applyDiscoverFilters(feedRows, {
      mood,
      filter: activeFilter,
      viewerId: user?.id,
      viewerLat,
      viewerLng,
      baseRadiusKm,
      viewerProfile,
      effectiveTier: subscriptionState.effectiveTier,
      hiddenPlanIds,
      viewerMatchedPlanIds: viewerMatchedPlanIdSet,
    });
  }, [
    feedRows,
    mood,
    activeFilter,
    user?.id,
    viewerLat,
    viewerLng,
    baseRadiusKm,
    viewerProfile,
    subscriptionState.effectiveTier,
    hiddenPlanIds,
    viewerMatchedPlanIdSet,
  ]);

  const meetTypeScoped = useMemo(() => {
    if (!meetTypeFilter) return preFiltered;
    return preFiltered.filter((p) => p.meet_type_id === meetTypeFilter.id);
  }, [preFiltered, meetTypeFilter]);

  const creatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of meetTypeScoped) {
      if (user?.id && r.creator_id === user.id) continue;
      ids.add(r.creator_id);
    }
    return [...ids];
  }, [meetTypeScoped, user?.id]);

  const presenceKey = creatorIds.join('|');

  const { data: presenceByUser = {} } = useQuery({
    queryKey: ['discover-presence', presenceKey],
    queryFn: () => fetchPresenceMap(creatorIds),
    enabled: creatorIds.length > 0,
    staleTime: 30_000,
  });

  const filteredWithPresence = useMemo(() => {
    if (activeFilter.hostPresence === 'all') return meetTypeScoped;
    return applyDiscoverFilters(meetTypeScoped, {
      mood,
      filter: activeFilter,
      viewerId: user?.id,
      viewerLat,
      viewerLng,
      baseRadiusKm,
      viewerProfile,
      presenceByUser,
      effectiveTier: subscriptionState.effectiveTier,
      hiddenPlanIds,
    });
  }, [
    meetTypeScoped,
    activeFilter,
    mood,
    user?.id,
    viewerLat,
    viewerLng,
    baseRadiusKm,
    viewerProfile,
    presenceByUser,
    subscriptionState.effectiveTier,
    hiddenPlanIds,
  ]);

  const moodRows = useMemo(
    () => moodTimelinePlans(filteredWithPresence, viewerLat, viewerLng),
    [filteredWithPresence, viewerLat, viewerLng]
  );
  const standardRows = useMemo(() => standardDiscoverPlans(filteredWithPresence), [filteredWithPresence]);

  const filterKey = [
    mood,
    activeFilter.maxDistanceKm ?? 'any',
    activeFilter.minPriceCents ?? 'min',
    activeFilter.maxPriceCents ?? 'max',
    activeFilter.verifiedHostsOnly ? 'verified' : 'all-hosts',
    activeFilter.hostPresence,
    activeFilter.planTypeFilter ?? 'all',
    activeFilter.clientFiltersActive ? 'on' : 'off',
    meetTypeFilter?.id ?? 'all',
  ].join('-');

  const presenceFor = (creatorId: string, creator: PlanFeedRow['creator']) =>
    derivePresenceUi(
      viewerProfile,
      creator?.preferences,
      presenceByUser[creatorId] ?? null,
      !!creator?.masked_activity_enabled
    );

  const distanceForPlan = (plan: PlanFeedRow) => distanceLabelFor(plan, viewerLat, viewerLng);

  const effectiveView = isMobileLayout && view === 'list' ? 'swipe' : view;

  useEffect(() => {
    setUiPage(0);
  }, [filterKey, effectiveView]);

  const paginatedPlans = useMemo(() => {
    if (effectiveView === 'swipe') return filteredWithPresence;
    const start = uiPage * UI_PAGE_SIZE;
    return filteredWithPresence.slice(start, start + UI_PAGE_SIZE);
  }, [filteredWithPresence, uiPage, effectiveView]);

  const uiPageCount = Math.max(1, Math.ceil(filteredWithPresence.length / UI_PAGE_SIZE));
  const showUiPagination = effectiveView !== 'swipe' && filteredWithPresence.length > UI_PAGE_SIZE;

  const neededPlanCount = (uiPage + 1) * UI_PAGE_SIZE;
  useEffect(() => {
    if (effectiveView === 'swipe') return;
    if (filteredWithPresence.length < neededPlanCount && hasMore && !isFetching && !showInitialLoading) {
      void loadMore();
    }
  }, [
    effectiveView,
    filteredWithPresence.length,
    neededPlanCount,
    hasMore,
    isFetching,
    showInitialLoading,
    loadMore,
  ]);

  const handleUiPageChange = (nextPage: number) => {
    setUiPage(nextPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const travelCityShort = travelCityLabel?.split(',')[0].trim() ?? null;

  const feedContent = (
    <>
      {isTravelModeActive && travelCityShort ? (
        <TravelModeBanner
          cityLabel={travelCityShort}
          isStale={isTravelModeStale}
          onTurnOff={() => void clearTravelMode()}
        />
      ) : null}

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
        isTravelModeActive && travelCityShort ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <IoAirplane size={40} className="text-muted/40" />
            <div>
              <p className="text-[16px] font-extrabold text-foreground">
                No plans in {travelCityShort} yet
              </p>
              <p className="mt-1 text-[13px] font-semibold text-muted">
                There are no active plans in this area right now. Check back later or browse your home
                city.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clearTravelMode()}
              className="rounded-full border border-border bg-white px-5 py-2.5 text-[13px] font-extrabold text-foreground transition hover:border-primary/30 hover:text-primary"
            >
              Turn off travel mode
            </button>
          </div>
        ) : (
        <AppEmptyState
          emoji="🔍"
          title="Nothing matches right now"
          titleAccent="matches"
          description={
            hasDiscoverPriceFilter(activeFilter)
              ? 'No plans fall in this price range. Widen your min/max price or clear price filters to see more meetups.'
              : 'Widen your radius, clear filters, or switch mood. Fresh plans sync from the same feed as the LinkUp app.'
          }
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
              text: 'Host a meetup. Mood moments show up near you when hosts are free now',
              iconBgClassName: 'bg-emerald-500/10',
              iconClassName: 'text-emerald-600',
            },
          ]}
          action={{
            label: 'Reset filters',
            onClick: () => {
              clearMeetTypeFilter();
              applyFilters(loadFeedFilterFromProfile(viewerProfile, baseRadiusKm), 'all');
            },
          }}
          secondaryAction={{ label: 'Create a plan', href: '/plan/create', variant: 'secondary' }}
        />
        )
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
          {paginatedPlans.map((plan) => (
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
          {paginatedPlans.map((plan) =>
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

      {showUiPagination ? (
        <AppPagination
          page={uiPage}
          totalPages={uiPageCount}
          onPageChange={handleUiPageChange}
          busy={isFetching}
          className="mt-2"
        />
      ) : null}

      {isFetching && !showInitialLoading ? (
        <p className="text-center text-[12px] font-semibold text-muted">Refreshing feed…</p>
      ) : null}
      {effectiveView === 'swipe' ? <div ref={sentinelRef} className="h-4 shrink-0" aria-hidden /> : null}
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

      {meetTypeFilter ? (
        <MeetTypeDiscoverPill
          name={meetTypeFilter.name}
          onClear={clearMeetTypeFilter}
          className={cn(isMobileLayout ? 'shrink-0' : undefined)}
        />
      ) : null}

      {moodRows.length > 0 ? <MoodPlanPushPrompt /> : null}

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
              filter={activeFilter}
              mood={mood}
              baseRadiusKm={baseRadiusKm}
              sliderMaxKm={sliderMaxKm}
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
            filter={activeFilter}
            mood={mood}
            baseRadiusKm={baseRadiusKm}
            sliderMaxKm={sliderMaxKm}
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
