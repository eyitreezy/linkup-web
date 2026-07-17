import type { QueryClient } from '@tanstack/react-query';
import { meetrMeetTypesQueryKey, meetTypesQueryKey } from '@/lib/plans/meetTypeQueryKeys';

export async function invalidateMeetTypeQueries(queryClient: QueryClient, userId?: string) {
  if (userId) {
    await queryClient.invalidateQueries({ queryKey: meetTypesQueryKey(userId) });
    await queryClient.invalidateQueries({ queryKey: meetrMeetTypesQueryKey(userId) });
    return;
  }
  await queryClient.invalidateQueries({ queryKey: ['meet-types'] });
  await queryClient.invalidateQueries({ queryKey: ['meetr-meet-types'] });
}
