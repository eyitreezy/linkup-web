'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Refetch creator plan management when the user's plans change. */
export function useCreatorPlansRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['creator-plans', userId] });
      },
      { table: 'plans', filter: `creator_id=eq.${userId}` },
      { channelPrefix: 'creator-plans-rt' }
    );
  }, [userId, queryClient]);
}
