'use client';

import {
  NOTIFICATIONS_QUERY_KEY,
  NOTIFICATIONS_UNREAD_QUERY_KEY,
} from '@/lib/notifications/queryKeys';
import { invalidateNotificationQueries } from '@/lib/notifications/invalidate';
import { createClient } from '@/lib/supabase/client';
import { countUnreadNotifications } from '@/services/notifications.service';
import { useAdminAccess } from '@/hooks/useAdminAccess';
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

type NotificationInboxContextValue = {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const NotificationInboxCtx = createContext<NotificationInboxContextValue | undefined>(undefined);

export function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, isLoading, refetch } = useQuery({
    queryKey: [NOTIFICATIONS_UNREAD_QUERY_KEY, user?.id, isAdmin],
    queryFn: async () => {
      if (!user?.id) return 0;
      return countUnreadNotifications(user.id, isAdmin);
    },
    enabled: !!user?.id && !adminLoading,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const client = createClient();
    const channel = client
      .channel(`inbox-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          invalidateNotificationQueries(queryClient, user.id);
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    invalidateNotificationQueries(queryClient, user.id);
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

  return <NotificationInboxCtx.Provider value={value}>{children}</NotificationInboxCtx.Provider>;
}

export function useNotificationInbox() {
  const ctx = useContext(NotificationInboxCtx);
  if (!ctx) throw new Error('useNotificationInbox must be used within NotificationInboxProvider');
  return ctx;
}

export function useNotificationInboxOptional() {
  return useContext(NotificationInboxCtx);
}
