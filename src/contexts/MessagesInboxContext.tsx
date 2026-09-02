'use client';

import { invalidateInboxQueries } from '@/lib/messaging/invalidate';
import { useInboxQuery } from '@/lib/messaging/useInboxQuery';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

type MessagesInboxContextValue = {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const MessagesInboxCtx = createContext<MessagesInboxContextValue | undefined>(undefined);

function maybeShowForegroundMessageNotification(rows: { id: string; unread: boolean; name: string; preview: string }[]) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;

  const unreadRow = rows.find((row) => row.unread);
  if (!unreadRow) return;

  const tag = `message-${unreadRow.id}`;
  if (navigator.serviceWorker?.controller) {
    void navigator.serviceWorker.ready.then((registration) => {
      void registration.showNotification(unreadRow.name, {
        body: unreadRow.preview,
        tag,
        icon: '/linkup-logo.png',
        badge: '/splash-icon.png',
        data: { type: 'message', chatId: unreadRow.id, url: `/messages?c=${unreadRow.id}` },
      });
    });
    return;
  }

  try {
    new Notification(unreadRow.name, {
      body: unreadRow.preview,
      tag,
      icon: '/linkup-logo.png',
    });
  } catch {
    // Ignore if notifications are unavailable.
  }
}

export function MessagesInboxProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { data, isPending, isFetching, refetch } = useInboxQuery();
  const previousUnreadRef = useRef(0);

  const unreadCount = useMemo(
    () => data?.rows.filter((r) => r.unread).length ?? 0,
    [data?.rows]
  );

  useEffect(() => {
    const activeConversationId =
      pathname.startsWith('/messages') && typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('c')
        : null;
    const rows = data?.rows ?? [];
    const unreadRows = rows.filter((row) => row.unread && row.id !== activeConversationId);

    if (unreadCount > previousUnreadRef.current && unreadRows.length > 0) {
      maybeShowForegroundMessageNotification(unreadRows);
    }
    previousUnreadRef.current = unreadCount;
  }, [data?.rows, pathname, unreadCount]);

  useEffect(() => {
    if (!userId) return;
    const client = createClient();
    const channel = client
      .channel(`inbox-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          invalidateInboxQueries(queryClient, userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          invalidateInboxQueries(queryClient, userId);
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    invalidateInboxQueries(queryClient, userId);
  }, [pathname, userId, queryClient]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    invalidateInboxQueries(queryClient, userId);
    await refetch();
  }, [userId, queryClient, refetch]);

  const value = useMemo(
    () => ({
      unreadCount,
      loading: isPending || isFetching,
      refresh,
    }),
    [unreadCount, isPending, isFetching, refresh]
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
