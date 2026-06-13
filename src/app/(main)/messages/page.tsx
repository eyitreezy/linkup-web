import { MessagesInbox } from '@/features/messages/MessagesInbox';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { prefetchInboxDehydrated } from '@/lib/messaging/prefetchInbox';
import { HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';

export const metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const user = await getServerAuthUser();
  const dehydratedState = user?.id ? await prefetchInboxDehydrated(user.id) : null;

  const content = (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-8 text-[14px] font-semibold text-muted">
          Loading inbox…
        </div>
      }
    >
      <MessagesInbox />
    </Suspense>
  );

  if (!dehydratedState) return content;

  return <HydrationBoundary state={dehydratedState}>{content}</HydrationBoundary>;
}
