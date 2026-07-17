'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Refetch wallet ledger and goodwill when the user's rows change. */
export function useWalletRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['wallet', userId] });
      },
      [
        { table: 'wallet_ledger', filter: `user_id=eq.${userId}` },
        { table: 'goodwill_credits', filter: `user_id=eq.${userId}` },
      ],
      { channelPrefix: 'wallet-rt' }
    );
  }, [userId, queryClient]);
}
