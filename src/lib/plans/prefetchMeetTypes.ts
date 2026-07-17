import { meetrMeetTypesQueryKey } from '@/lib/plans/meetTypeQueryKeys';
import { createClient } from '@/lib/supabase/server';
import { fetchMeetTypesForUser } from '@/services/meetTypes.service';
import type { DbMeetType } from '@/types/database';
import { dehydrate, QueryClient, type DehydratedState } from '@tanstack/react-query';

export { meetrMeetTypesQueryKey } from '@/lib/plans/meetTypeQueryKeys';

/** Server-side meet types seed for Meetr grid. */
export async function prefetchMeetTypesDehydrated(userId: string): Promise<DehydratedState> {
  const queryClient = new QueryClient();
  const supabase = await createClient();
  const { rows } = await fetchMeetTypesForUser(supabase, userId);
  const visible = rows;
  queryClient.setQueryData<DbMeetType[]>(meetrMeetTypesQueryKey(userId), visible);
  return dehydrate(queryClient);
}
