import { INBOX_QUERY_KEY, MESSAGES_UNREAD_QUERY_KEY } from '@/lib/messaging/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

export function invalidateInboxQueries(queryClient: QueryClient, userId?: string | null) {
  void queryClient.invalidateQueries({
    queryKey: userId ? [INBOX_QUERY_KEY, userId] : [INBOX_QUERY_KEY],
  });
  void queryClient.invalidateQueries({
    queryKey: userId ? [MESSAGES_UNREAD_QUERY_KEY, userId] : [MESSAGES_UNREAD_QUERY_KEY],
  });
}
