import {
  NOTIFICATIONS_QUERY_KEY,
  NOTIFICATIONS_UNREAD_QUERY_KEY,
} from '@/lib/notifications/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

export function invalidateNotificationQueries(queryClient: QueryClient, userId?: string | null) {
  void queryClient.invalidateQueries({
    queryKey: userId ? [NOTIFICATIONS_QUERY_KEY, userId] : [NOTIFICATIONS_QUERY_KEY],
  });
  void queryClient.invalidateQueries({
    queryKey: userId ? [NOTIFICATIONS_UNREAD_QUERY_KEY, userId] : [NOTIFICATIONS_UNREAD_QUERY_KEY],
  });
}
