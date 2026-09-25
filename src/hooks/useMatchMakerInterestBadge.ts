'use client';

import { useMatchMakerInterestRealtime } from '@/hooks/useMatchMakerInterestRealtime';
import { fetchMatchMakerInterestQueue } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export function useMatchMakerInterestBadge(userId: string | undefined) {
  useMatchMakerInterestRealtime(userId);

  const query = useQuery({
    queryKey: ['matchmaker-interest-badge', userId],
    queryFn: async () => {
      const client = createClient();
      const result = await fetchMatchMakerInterestQueue(client, userId);
      if (result.error) throw new Error(result.error);
      return result.data?.receivedUnopenedCount ?? 0;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  return query.data ?? 0;
}
