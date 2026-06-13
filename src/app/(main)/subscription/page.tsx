import { SubscriptionScreen } from '@/features/subscription/SubscriptionScreen';
import { Suspense } from 'react';

export const metadata = { title: 'Subscription' };

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />}>
      <SubscriptionScreen />
    </Suspense>
  );
}
