import { MessagesInbox } from '@/features/messages/MessagesInbox';
import { Suspense } from 'react';

export const metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
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
}
