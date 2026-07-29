'use client';

import '@/features/plan-management/plan-management.css';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { PlanManagementHeader } from '@/features/plan-management/PlanManagementHeader';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PlanCreatorEditModal } from '@/features/plan-management/PlanCreatorEditModal';
import { PlanManagementCard } from '@/features/plan-management/PlanManagementCard';
import { usePlanManagementPage } from '@/features/plan-management/PlanManagementPageContext';
import { PlanManagementSortFilterRail } from '@/features/plan-management/PlanManagementSortFilterRail';
import { distanceKm } from '@/lib/location/distance';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import {
  countBySection,
  planMatchesSection,
  planSearchBlob,
  sortCreatorPlans,
  type CreatorPlanRow,
} from '@/lib/plans/planManagement';
import { createClient } from '@/lib/supabase/client';
import {
  archiveCreatorPlan,
  deleteCreatorDraft,
  duplicateCreatorPlan,
  fetchCreatorPlanById,
  fetchCreatorPlanStats,
  fetchCreatorPlans,
  unarchiveCreatorPlan,
} from '@/services/planManagement.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useCreatorPlansRealtime } from '@/hooks/useCreatorPlansRealtime';
import { useIsMobileShellLayout } from '@/hooks/use-media-query';
import { PlanManagementSkeleton } from '@/features/plan-management/PlanManagementSkeleton';
import { useAuthStore } from '@/stores/auth-store';
import { pmShell, pmShellPb } from '@/features/plan-management/planManagementLayout';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoAlbums, IoCloseCircle, IoSearchOutline } from 'react-icons/io5';

type ShelfDialog = { kind: 'archive' | 'delete'; planId: string } | null;

const EMPTY_PLANS: CreatorPlanRow[] = [];

export function PlanManagementScreen() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const isMobile = useIsMobileShellLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { section, sort, setSection, setSectionCounts } = usePlanManagementPage();
  const [query, setQuery] = useState('');
  const [shelfDialog, setShelfDialog] = useState<ShelfDialog>(null);
  const [editPlan, setEditPlan] = useState<CreatorPlanRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shelfBusy, setShelfBusy] = useState(false);

  useCreatorPlansRealtime(user?.id);

  const { data: profileBundle } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const userLat = profileBundle?.profile?.latitude ?? null;
  const userLng = profileBundle?.profile?.longitude ?? null;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['creator-plans', user?.id],
    queryFn: async () => {
      if (!user?.id) return { plans: [] as CreatorPlanRow[], stats: { offersCountByPlan: {}, viewsByPlan: {} } };
      const client = createClient();
      const { plans, error: loadErr } = await fetchCreatorPlans(client, user.id);
      if (loadErr) throw new Error(loadErr);
      const stats = await fetchCreatorPlanStats(
        client,
        plans.map((p) => p.id)
      );
      return { plans, stats };
    },
    enabled: !!user?.id,
  });

  const plans = data?.plans ?? EMPTY_PLANS;
  const offersCountByPlan = data?.stats.offersCountByPlan ?? {};
  const viewsByPlan = data?.stats.viewsByPlan ?? {};

  const sectionCounts = useMemo(() => countBySection(plans), [plans]);
  const activeLivingCount = sectionCounts.active;

  useEffect(() => {
    setSectionCounts(sectionCounts);
  }, [
    setSectionCounts,
    sectionCounts.all,
    sectionCounts.active,
    sectionCounts.mood,
    sectionCounts.expired,
    sectionCounts.drafts,
    sectionCounts.archived,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = plans.filter((p) => {
      if (!planMatchesSection(p, section)) return false;
      if (!q) return true;
      return planSearchBlob(p).includes(q);
    });
    return sortCreatorPlans(list, sort);
  }, [plans, query, section, sort]);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['creator-plans', user?.id] });
  }

  async function handleDuplicate(p: CreatorPlanRow) {
    const client = createClient();
    const { data: newId, error: dupErr } = await duplicateCreatorPlan(client, p.id);
    if (dupErr) {
      setFeedback(dupErr.message);
      return;
    }
    const id = typeof newId === 'string' ? newId : newId != null ? String(newId) : null;
    if (!id) {
      void invalidate();
      return;
    }
    await invalidate();
    const { plan: dup, error: loadErr } = await fetchCreatorPlanById(client, id);
    if (loadErr || !dup) {
      setFeedback(loadErr ?? 'Duplicated, but could not open the editor.');
      router.push(`/plan/${id}`);
      return;
    }
    setEditPlan(dup);
  }

  // AuthMainLayout gates the route; this skeleton only covers rare client re-hydration gaps.
  if (authLoading || !user) {
    return <PlanManagementSkeleton className={isMobile ? 'max-lg:pb-[var(--linkup-tab-clearance)]' : undefined} />;
  }

  const emptyTitle =
    plans.length === 0 ? 'No meetups yet' : query.trim() ? 'No matches' : 'Nothing in this filter';
  const emptySub =
    plans.length === 0
      ? 'When you publish a plan, it shows up here: mood sparks and longer ideas together.'
      : query.trim()
        ? 'Try another keyword, clear search, or switch to All.'
        : 'Try the All tab or pick another shelf above.';

  return (
    <div
      className={cn(
        pmShell,
        pmShellPb,
        isMobile && 'max-lg:pb-[var(--linkup-tab-clearance)]'
      )}
    >
      <PlanManagementHeader />

      <div className="pm-stats-banner linkup-gradient-primary shadow-lg">
        <div className="pm-stats-inner bg-white/10 backdrop-blur-sm">
          <div className="pm-stats-top">
            <p className="pm-stat-label min-w-0 truncate text-white/90">Overview</p>
            <span className="pm-stats-sync">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ADE80]" aria-hidden />
              Synced
            </span>
          </div>
          <div className="pm-stats-grid">
            <div className="pm-stat-cell min-w-0">
              <p className="pm-stat-label">Plans in your name</p>
              <p className="pm-stat-value font-display">{plans.length}</p>
            </div>
            <div className="pm-stat-cell min-w-0">
              <p className="pm-stat-label">Live in discovery</p>
              <p className="pm-stat-value font-display">{activeLivingCount}</p>
            </div>
          </div>
          <p className="pm-stat-hint mt-3 text-white/90">
            Filters below slice your catalog without hiding plans in other shelves.
          </p>
        </div>
      </div>

      {feedback ? (
        <p className="pm-feedback flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-3 font-semibold text-[#EF4444]">
          <span className="min-w-0 flex-1">{feedback}</span>
          <button
            type="button"
            className="pm-tap-target shrink-0 px-2 font-extrabold underline"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="pm-search-shell rounded-2xl border border-primary/15 bg-white/90 shadow-sm min-[425px]:rounded-2xl">
        <IoSearchOutline className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plans…"
          aria-label="Search plans"
          className="min-w-0 flex-1 bg-transparent font-semibold text-foreground outline-none placeholder:text-muted"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="pm-tap-target inline-flex shrink-0 items-center justify-center"
          >
            <IoCloseCircle className="h-5 w-5 text-muted" />
          </button>
        ) : null}
      </div>

      {/* Below xl the Sort and filter rail is in the main column. */}
      <div className="min-w-0 max-w-full xl:hidden">
        <PlanManagementSortFilterRail />
      </div>

      {error ? (
        <p className="pm-body-text font-semibold text-[#EF4444]">
          {error instanceof Error ? error.message : 'Could not load plans'}
          <button
            type="button"
            className="ml-2 font-extrabold text-primary underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {isLoading || isFetching ? (
        <ul className="pm-plan-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="w-full min-w-0">
              <div className="h-32 w-full animate-pulse rounded-2xl bg-[#EDE8FF]/70 max-[424px]:h-28" />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <AppEmptyState
          className="pm-empty-state !px-4 !py-8 min-[425px]:!px-6 min-[425px]:!py-10"
          icon={<IoAlbums className="h-9 w-9 text-primary" />}
          title={emptyTitle}
          description={emptySub}
          action={
            plans.length === 0
              ? { label: 'Create your first plan', href: '/plan/create' }
              : { label: 'Show all plans', onClick: () => setSection('all'), variant: 'secondary' }
          }
          secondaryAction={
            plans.length === 0 ? undefined : { label: 'Create plan', href: '/plan/create', variant: 'secondary' }
          }
        />
      ) : (
        <ul className="pm-plan-list">
          {filtered.map((p) => {
            const meetup = planMeetupCoords(p);
            const dist =
              userLat != null && userLng != null && meetup
                ? distanceKm(userLat, userLng, meetup.lat, meetup.lng)
                : null;
            return (
              <li key={p.id} className="w-full min-w-0">
                <PlanManagementCard
                  plan={p}
                  views={viewsByPlan[p.id] ?? 0}
                  offers={offersCountByPlan[p.id] ?? 0}
                  distanceKm={dist}
                  onEdit={() => setEditPlan(p)}
                  onDuplicate={() => void handleDuplicate(p)}
                  onArchive={() => setShelfDialog({ kind: 'archive', planId: p.id })}
                  onRestore={async () => {
                    const { error: err } = await unarchiveCreatorPlan(createClient(), p.id);
                    if (err) setFeedback(err.message);
                    else void invalidate();
                  }}
                  onDelete={() => setShelfDialog({ kind: 'delete', planId: p.id })}
                />
              </li>
            );
          })}
        </ul>
      )}

      <PlanCreatorEditModal
        plan={editPlan}
        offersCount={editPlan ? (offersCountByPlan[editPlan.id] ?? 0) : 0}
        onClose={() => setEditPlan(null)}
        onSaved={() => void invalidate()}
      />

      <ConfirmDialog
        open={shelfDialog != null}
        title={shelfDialog?.kind === 'delete' ? 'Delete this draft?' : 'Archive this plan?'}
        message={
          shelfDialog?.kind === 'delete'
            ? 'This permanently removes the draft. Published plans are archived instead of deleted.'
            : 'It leaves active shelves and discovery. Restore anytime from Archived.'
        }
        cancelLabel={shelfDialog?.kind === 'delete' ? 'Keep draft' : 'Not now'}
        confirmLabel={shelfDialog?.kind === 'delete' ? 'Delete draft' : 'Archive plan'}
        confirmVariant={shelfDialog?.kind === 'delete' ? 'danger' : 'neutral'}
        busy={shelfBusy}
        onClose={() => setShelfDialog(null)}
        onConfirm={async () => {
          if (!shelfDialog) return;
          setShelfBusy(true);
          const client = createClient();
          try {
            if (shelfDialog.kind === 'delete') {
              const { error: err } = await deleteCreatorDraft(client, shelfDialog.planId);
              if (err) throw new Error(err.message);
            } else {
              const { error: err } = await archiveCreatorPlan(client, shelfDialog.planId);
              if (err) throw new Error(err.message);
            }
            setShelfDialog(null);
            void invalidate();
          } catch (e) {
            setFeedback(e instanceof Error ? e.message : 'Action failed');
          } finally {
            setShelfBusy(false);
          }
        }}
      />
    </div>
  );
}
