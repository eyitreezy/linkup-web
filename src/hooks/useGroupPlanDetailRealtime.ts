'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Keep group plan detail, escrows, and invite slots in sync after roster or funding changes. */
export function useGroupPlanDetailRealtime(
  planId: string | undefined,
  enabled: boolean
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!planId || !enabled) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-group-escrows', planId] });
    };

    return subscribePostgresRealtime(
      invalidate,
      [
        { table: 'plans', filter: `id=eq.${planId}`, event: 'UPDATE' },
        { table: 'escrow_transactions', filter: `plan_id=eq.${planId}` },
        { table: 'plan_invitations', filter: `plan_id=eq.${planId}` },
        { table: 'plan_join_requests', filter: `plan_id=eq.${planId}` },
        { table: 'plan_offers', filter: `plan_id=eq.${planId}` },
      ],
      { channelPrefix: 'group-plan-detail-rt' }
    );
  }, [enabled, planId, queryClient]);
}
