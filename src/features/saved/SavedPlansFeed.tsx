'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { SavedUpgradeEmptyState } from '@/components/subscription/SavedUpgradeEmptyState';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { usePermission } from '@/hooks/usePermission';
import { SavedPlanCard } from '@/features/saved/SavedPlanCard';
import { useTogglePlanSaved } from '@/features/saved/useTogglePlanSaved';
import { useIsMobileShellLayout } from '@/hooks/use-media-query';
import { savedPlansQueryKey } from '@/lib/plans/savedPlansQuery';
import { createClient } from '@/lib/supabase/client';
import { fetchSavedPlansList } from '@/services/savedPlans.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { IoBookmarkOutline, IoHeartOutline } from 'react-icons/io5';

function SavedListSkeleton() {
  return (
    <ul className="flex w-full min-w-0 flex-col gap-2.5 min-[360px]:gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="w-full min-w-0">
          <div className="linkup-card flex w-full min-w-0 gap-2.5 overflow-hidden rounded-[18px] p-2.5 pl-3 min-[360px]:gap-3 min-[360px]:p-3.5">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#EDE8FF]/80 min-[360px]:h-12 min-[360px]:w-12" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-[85%] animate-pulse rounded-lg bg-[#EDE8FF]/80" />
              <div className="h-3 w-1/2 animate-pulse rounded-lg bg-[#EDE8FF]/60" />
              <div className="h-3 w-2/3 animate-pulse rounded-lg bg-[#EDE8FF]/60" />
            </div>
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[#EDE8FF]/80" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SavedPlansFeed() {
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobileShellLayout();
  const toggleSaved = useTogglePlanSaved(user?.id);
  const { allowed: bookmarkAllowed, loading: permissionLoading } = usePermission('plans.bookmark');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: savedPlansQueryKey(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const client = createClient();
      return fetchSavedPlansList(client, user.id);
    },
    enabled: !!user?.id,
  });

  const items = data ?? [];

  if (!permissionLoading && !bookmarkAllowed) {
    return (
      <div
        className={cn(
          'min-w-0 space-y-4 min-[360px]:space-y-5 min-[400px]:space-y-6',
          'pb-8 min-[400px]:pb-10',
          isMobile && 'max-lg:pb-[var(--linkup-tab-clearance)]'
        )}
      >
        <TabPageHeader
          kicker="Bookmarks"
          title="Saved"
          description="Plans you saved from Discover — synced with the mobile app."
          icon={<IoBookmarkOutline size={22} />}
        />
        <SavedUpgradeEmptyState requiredTier="SILVER" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-w-0 space-y-4 min-[360px]:space-y-5 min-[400px]:space-y-6',
        'pb-8 min-[400px]:pb-10',
        isMobile && 'max-lg:pb-[var(--linkup-tab-clearance)]'
      )}
    >
      <TabPageHeader
        kicker="Bookmarks"
        title="Saved"
        description="Plans you saved from Discover — synced with the mobile app."
        descriptionClassName="hidden min-[400px]:block"
        icon={<IoBookmarkOutline size={22} />}
        trailing={
          items.length > 0 ? (
            <span className="rounded-full bg-[#EDE8FF] px-2.5 py-1 text-[10px] font-extrabold text-primary min-[360px]:px-3 min-[360px]:text-[11px] sm:text-[12px]">
              {items.length} saved
            </span>
          ) : null
        }
        className="!gap-2 min-[400px]:!gap-3"
      />

      {error ? (
        <p className="px-0.5 text-[13px] font-semibold text-[#EF4444] min-[360px]:text-[14px]">
          {error instanceof Error ? error.message : 'Could not load saved plans'}
          <button
            type="button"
            className="ml-2 font-extrabold text-primary underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {toggleSaved.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {toggleSaved.error instanceof Error ? toggleSaved.error.message : 'Could not update save'}
        </p>
      ) : null}

      {isLoading ? (
        <SavedListSkeleton />
      ) : items.length === 0 ? (
        <AppEmptyState
          emoji="🔖"
          title="No saved plans yet"
          titleAccent="saved"
          description="Tap Save on any Discover card (Silver and above) — your shortlist stays in sync with the mobile app."
          tips={[
            { icon: IoBookmarkOutline, text: 'Saved plans keep host, price, and mood context handy' },
            {
              icon: IoHeartOutline,
              text: 'When you’re ready, open a plan and send an offer',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
          ]}
          action={{ label: 'Browse Discover', href: '/discover' }}
          secondaryAction={{ label: 'See plans', href: '/subscription', variant: 'secondary' }}
        />
      ) : (
        <ul className="flex w-full min-w-0 flex-col gap-2.5 min-[360px]:gap-3 sm:gap-4">
          {items.map((item) => (
            <li key={item.plan.id} className="w-full min-w-0">
              <SavedPlanCard
                item={item}
                unsaving={
                  toggleSaved.isPending && toggleSaved.variables?.planId === item.plan.id
                }
                onUnsave={() => {
                  if (!user?.id) return;
                  if (window.confirm(`Remove “${item.plan.title}” from saved?`)) {
                    toggleSaved.mutate({
                      planId: item.plan.id,
                      userId: user.id,
                      saved: false,
                    });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
