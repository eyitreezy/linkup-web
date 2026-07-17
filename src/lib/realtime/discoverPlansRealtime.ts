'use client';

import type { PlanFeedRow } from '@/services/plans.service';
import type { QueryClient } from '@tanstack/react-query';
import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';

function shouldRemoveFromDiscoverFeed(row: {
  status?: string;
  is_group_plan?: boolean;
  is_suppressed?: boolean;
  archived_at?: string | null;
}): boolean {
  return (
    row.is_suppressed === true ||
    (row.archived_at != null && row.archived_at !== '') ||
    (row.status != null &&
      (['agreed', 'active', 'completed', 'cancelled'].includes(row.status) ||
        (row.status === 'awaiting_payment' && !row.is_group_plan)))
  );
}

/** New discoverable plans — refetch so filters/ranking stay correct. */
export function subscribeDiscoverPlansInsertRealtime(
  queryClient: QueryClient,
  discoverQueryKey: readonly unknown[]
): () => void {
  return subscribePostgresRealtime(
    () => {
      void queryClient.invalidateQueries({ queryKey: discoverQueryKey });
    },
    { table: 'plans', event: 'INSERT' },
    { channelPrefix: 'discover-plans-insert-rt' }
  );
}

/** Optimistic cache patch for plan UPDATE/DELETE before invalidation runs. */
export function handleDiscoverPlanRealtimePayload(
  queryClient: QueryClient,
  discoverQueryKey: readonly unknown[],
  payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
) {
  const event = payload.eventType;
  if (event === 'DELETE') {
    const id = payload.old.id as string | undefined;
    if (!id) return;
    queryClient.setQueryData<PlanFeedRow[]>(discoverQueryKey, (prev) =>
      (prev ?? []).filter((p) => p.id !== id)
    );
    return;
  }

  const row = payload.new as {
    id?: string;
    status?: string;
    is_group_plan?: boolean;
    is_suppressed?: boolean;
    archived_at?: string | null;
  };
  if (!row?.id) return;

  if (event === 'INSERT') {
    void queryClient.invalidateQueries({ queryKey: discoverQueryKey });
    return;
  }

  if (event === 'UPDATE') {
    if (shouldRemoveFromDiscoverFeed(row)) {
      queryClient.setQueryData<PlanFeedRow[]>(discoverQueryKey, (prev) =>
        (prev ?? []).filter((p) => p.id !== row.id)
      );
    } else {
      void queryClient.invalidateQueries({ queryKey: discoverQueryKey });
    }
  }
}
