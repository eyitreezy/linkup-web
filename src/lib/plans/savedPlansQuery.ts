import type { PlanDetailBundle } from '@/services/planDetail.service';
import type { PlanFeedRow } from '@/services/plans.service';
import type { SavedPlanListItem } from '@/services/savedPlans.service';
import type { QueryClient } from '@tanstack/react-query';

export function savedPlansQueryKey(userId: string | undefined) {
  return ['saved-plans', userId] as const;
}

export function planDetailQueryKey(planId: string, userId: string | undefined) {
  return ['plan-detail', planId, userId] as const;
}

export function removeSavedPlanFromCache(
  queryClient: QueryClient,
  userId: string,
  planId: string
) {
  queryClient.setQueryData<SavedPlanListItem[]>(savedPlansQueryKey(userId), (old) =>
    (old ?? []).filter((item) => item.plan.id !== planId)
  );
}

export function addSavedPlanToCache(
  queryClient: QueryClient,
  userId: string,
  plan: PlanFeedRow,
  savedAt = new Date().toISOString()
) {
  queryClient.setQueryData<SavedPlanListItem[]>(savedPlansQueryKey(userId), (old) => {
    const items = old ?? [];
    if (items.some((item) => item.plan.id === plan.id)) return items;
    const entry: SavedPlanListItem = {
      plan,
      creator: {
        display_name: plan.creator?.display_name ?? null,
        avatar_url: plan.creator?.avatar_url ?? null,
        verified_badge: !!plan.creator?.verified_badge,
      },
      savedAt,
    };
    return [entry, ...items];
  });
}

export function patchPlanDetailSavedFlag(
  queryClient: QueryClient,
  planId: string,
  userId: string | undefined,
  saved: boolean
) {
  queryClient.setQueryData<PlanDetailBundle>(planDetailQueryKey(planId, userId), (old) =>
    old ? { ...old, saved } : old
  );
}

export async function syncSavedPlansCache(
  queryClient: QueryClient,
  userId: string | undefined
) {
  if (!userId) return;
  await queryClient.invalidateQueries({ queryKey: savedPlansQueryKey(userId) });
}
