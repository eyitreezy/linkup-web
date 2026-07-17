import { getServerAuthUser } from '@/lib/auth/server-session';
import { prefetchProfileBundleDehydrated } from '@/lib/profile/prefetchProfileBundle';
import { HydrationBoundary } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const DiscoverFeed = dynamic(
  () => import('@/features/discover/DiscoverFeed').then((m) => ({ default: m.DiscoverFeed })),
  { loading: () => null }
);

export const metadata = { title: 'Discover' };

export default async function DiscoverPage() {
  const user = await getServerAuthUser();
  const dehydratedState = user?.id ? await prefetchProfileBundleDehydrated(user.id) : null;
  const feed = <DiscoverFeed />;

  if (!dehydratedState) return feed;
  return <HydrationBoundary state={dehydratedState}>{feed}</HydrationBoundary>;
}
