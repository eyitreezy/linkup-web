'use client';

import {
  addSavedPlanToCache,
  patchPlanDetailSavedFlag,
  planDetailQueryKey,
  removeSavedPlanFromCache,
  savedPlansQueryKey,
  syncSavedPlansCache,
} from '@/lib/plans/savedPlansQuery';
import { createClient } from '@/lib/supabase/client';
import type { PlanFeedRow } from '@/services/plans.service';
import type { SavedPlanListItem } from '@/services/savedPlans.service';
import { setPlanSaved } from '@/services/savedPlans.service';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type ToggleArgs = {
  planId: string;
  userId: string;
  saved: boolean;
  plan?: PlanFeedRow;
};

export function useTogglePlanSaved(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, userId: uid, saved }: ToggleArgs) => {
      const client = createClient();
      const { error } = await setPlanSaved(client, planId, uid, saved);
      if (error) throw new Error(error);
    },
    onMutate: async ({ planId, userId: uid, saved, plan }) => {
      await queryClient.cancelQueries({ queryKey: savedPlansQueryKey(uid) });

      const previousList = queryClient.getQueryData<SavedPlanListItem[]>(savedPlansQueryKey(uid));
      const previousDetail = queryClient.getQueryData(planDetailQueryKey(planId, uid));

      patchPlanDetailSavedFlag(queryClient, planId, uid, saved);
      if (saved && plan) {
        addSavedPlanToCache(queryClient, uid, plan);
      } else {
        removeSavedPlanFromCache(queryClient, uid, planId);
      }

      return { previousList, previousDetail, planId, userId: uid };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      if (context.previousList) {
        queryClient.setQueryData(savedPlansQueryKey(context.userId), context.previousList);
      }
      if (context.previousDetail) {
        queryClient.setQueryData(
          planDetailQueryKey(context.planId, context.userId),
          context.previousDetail
        );
      }
    },
    onSettled: async (_data, _err, { userId: uid }) => {
      await syncSavedPlansCache(queryClient, uid);
    },
  });
}
