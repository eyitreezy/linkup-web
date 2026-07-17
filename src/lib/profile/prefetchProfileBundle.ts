import { createClient } from '@/lib/supabase/server';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { dehydrate, QueryClient, type DehydratedState } from '@tanstack/react-query';

export const profileBundleQueryKey = (userId: string) => ['profile-bundle', userId] as const;

/** Server-side profile bundle seed — shared by Discover and shell consumers. */
export async function prefetchProfileBundleDehydrated(userId: string): Promise<DehydratedState> {
  const queryClient = new QueryClient();
  const supabase = await createClient();
  const bundle = await fetchUserProfileBundle(supabase, userId);
  queryClient.setQueryData(profileBundleQueryKey(userId), bundle);
  return dehydrate(queryClient);
}
