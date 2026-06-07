'use client';

import { invalidateInboxQueries } from '@/lib/messaging/invalidate';
import { MESSAGES_UNREAD_QUERY_KEY } from '@/lib/messaging/queryKeys';
import { createClient } from '@/lib/supabase/client';
import { countUnreadConversations } from '@/services/messages.service';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

type MessagesInboxContextValue = {
  /** Number of conversations with unread messages (same as mobile `unreadTotal`). */
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const MessagesInboxCtx = createContext<MessagesInboxContextValue | undefined>(undefined);

export function MessagesInboxProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, isLoading, refetch } = useQuery({
    queryKey: [MESSAGES_UNREAD_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const client = createClient();
      return countUnreadConversations(client, user.id);
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const client = createClient();
    const channel = client
      .channel(`inbox-messages:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          invalidateInboxQueries(queryClient, user.id);
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    invalidateInboxQueries(queryClient, user.id);
    await refetch();
  }, [user?.id, queryClient, refetch]);

  const value = useMemo(
    () => ({
      unreadCount,
      loading: isLoading,
      refresh,
    }),
    [unreadCount, isLoading, refresh]
  );

  return <MessagesInboxCtx.Provider value={value}>{children}</MessagesInboxCtx.Provider>;
}

export function useMessagesInbox() {
  const ctx = useContext(MessagesInboxCtx);
  if (!ctx) throw new Error('useMessagesInbox must be used within MessagesInboxProvider');
  return ctx;
}

export function useMessagesInboxOptional() {
  return useContext(MessagesInboxCtx);
}
