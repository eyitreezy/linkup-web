'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import { fetchMatchMakerConnection } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useMatchMakerConnection(connectionId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['matchmaker-connection', connectionId],
    queryFn: async () => {
      if (!connectionId) return null;
      const client = createClient();
      const { data, error } = await fetchMatchMakerConnection(client, connectionId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!connectionId,
  });

  useEffect(() => {
    if (!connectionId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-connection', connectionId] });
      },
      { table: 'matchmaker_connections', filter: `id=eq.${connectionId}` },
      { channelPrefix: `mm-connection-${connectionId}` }
    );
  }, [connectionId, queryClient]);

  useEffect(() => {
    if (!connectionId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-activity', connectionId] });
      },
      { table: 'matchmaker_shared_activities', filter: `connection_id=eq.${connectionId}` },
      { channelPrefix: `mm-activity-${connectionId}` }
    );
  }, [connectionId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-gate', userId] });
      },
      { table: 'matchmaker_connections', filter: `user_a_id=eq.${userId}` },
      { channelPrefix: `mm-connection-a-${userId}` }
    );
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-gate', userId] });
      },
      { table: 'matchmaker_connections', filter: `user_b_id=eq.${userId}` },
      { channelPrefix: `mm-connection-b-${userId}` }
    );
  }, [userId, queryClient]);

  return {
    connection: query.data as MatchMakerConnectionRow | null | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
