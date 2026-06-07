import { PremiumCheckoutScreen } from '@/features/premium/PremiumCheckoutScreen';
import { Suspense } from 'react';

export const metadata = { title: 'Premium checkout' };

export default function PremiumCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
          <div className="h-48 animate-pulse rounded-2xl bg-[#FFF0F5]/70" />
        </div>
      }
    >
      <PremiumCheckoutScreen />
    </Suspense>
  );
}
