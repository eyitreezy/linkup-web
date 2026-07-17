'use client';

import {
  handleDiscoverPlanRealtimePayload,
  subscribeDiscoverPlansInsertRealtime,
} from '@/lib/realtime/discoverPlansRealtime';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Discover feed: immediate cache patch on UPDATE/DELETE + debounced invalidation on INSERT.
 */
export function useDiscoverPlansRealtime(
  userId: string | undefined,
  discoverQueryKey: readonly unknown[]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const client = createClient();
    const channelName = `discover-plans-patch:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
    const patchChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans' },
        (payload) => {
          handleDiscoverPlanRealtimePayload(queryClient, discoverQueryKey, {
            eventType: 'UPDATE',
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'plans' },
        (payload) => {
          handleDiscoverPlanRealtimePayload(queryClient, discoverQueryKey, {
            eventType: 'DELETE',
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        }
      )
      .subscribe();

    const unsubInsert = subscribeDiscoverPlansInsertRealtime(queryClient, discoverQueryKey);

    return () => {
      void client.removeChannel(patchChannel);
      unsubInsert();
    };
  }, [userId, queryClient, discoverQueryKey]);
}
