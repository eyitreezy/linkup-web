import { inboxQueryKey } from '@/lib/messaging/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

export function invalidateInboxQueries(queryClient: QueryClient, userId?: string | null) {
  void queryClient.invalidateQueries({
    queryKey: inboxQueryKey(userId),
  });
}
