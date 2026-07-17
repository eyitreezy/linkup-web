'use client';

import { inboxQueryKey } from '@/lib/messaging/queryKeys';
import { createClient } from '@/lib/supabase/client';
import { fetchInbox, type InboxRow } from '@/services/messages.service';
import { useAuthStore } from '@/stores/auth-store';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export type InboxQueryData = {
  rows: InboxRow[];
};

async function loadInbox(userId: string): Promise<InboxQueryData> {
  const client = createClient();
  const result = await fetchInbox(client, userId);
  if (result.error) throw new Error(result.error);
  return { rows: result.rows };
}

export function useInboxQuery() {
  const userId = useAuthStore((s) => s.user?.id);
  const authLoading = useAuthStore((s) => s.loading);

  return useQuery({
    queryKey: inboxQueryKey(userId),
    queryFn: () => loadInbox(userId!),
    enabled: !authLoading && !!userId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
