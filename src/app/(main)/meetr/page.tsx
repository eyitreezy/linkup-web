import { getServerAuthUser } from '@/lib/auth/server-session';
import { prefetchMeetTypesDehydrated } from '@/lib/plans/prefetchMeetTypes';
import { HydrationBoundary } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const MeetrScreen = dynamic(
  () => import('@/features/meetr/MeetrScreen').then((m) => ({ default: m.MeetrScreen })),
  { loading: () => null }
);

export const metadata = { title: 'Meetr' };

export default async function MeetrPage() {
  const user = await getServerAuthUser();
  const dehydratedState = user?.id ? await prefetchMeetTypesDehydrated(user.id) : null;
  const screen = <MeetrScreen />;

  if (!dehydratedState) return screen;
  return <HydrationBoundary state={dehydratedState}>{screen}</HydrationBoundary>;
}
