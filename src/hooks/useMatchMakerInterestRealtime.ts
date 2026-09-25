'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Refetch interest queue and nav badge when matchmaker_interests changes. */
export function useMatchMakerInterestRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-queue', userId] });
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-badge', userId] });
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', userId] });
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-member-interaction'] });
      },
      { table: 'matchmaker_interests' },
      { channelPrefix: 'matchmaker-interests-rt' }
    );
  }, [userId, queryClient]);
}
