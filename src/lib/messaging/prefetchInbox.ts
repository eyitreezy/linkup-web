import { createClient } from '@/lib/supabase/server';
import { fetchInbox } from '@/services/messages.service';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { DehydratedState } from '@tanstack/react-query';
import { inboxQueryKey } from '@/lib/messaging/queryKeys';

/** Server-side inbox seed — eliminates client auth/session race on first paint. */
export async function prefetchInboxDehydrated(userId: string): Promise<DehydratedState> {
  const queryClient = new QueryClient();
  const supabase = await createClient();
  const result = await fetchInbox(supabase, userId);
  if (!result.error) {
    queryClient.setQueryData(inboxQueryKey(userId), { rows: result.rows });
  }
  return dehydrate(queryClient);
}
