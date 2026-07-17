'use client';

import { invalidateMeetTypeQueries } from '@/lib/plans/invalidateMeetTypeQueries';
import { subscribeMeetTypesRealtime } from '@/lib/plans/subscribeMeetTypesRealtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Refetch plan wizard + Meetr meet type lists when meet_types rows change. */
export function useMeetTypesRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribeMeetTypesRealtime(() => {
      void invalidateMeetTypeQueries(queryClient, userId);
    });
  }, [userId, queryClient]);
}
