'use client';

import { TIER_META } from '@/lib/subscription/constants';
import { deriveSubscriptionState } from '@/lib/subscription/deriveState';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const status = searchParams.get('status');
  const [phase, setPhase] = useState<'processing' | 'success' | 'failed'>('processing');
  const [message, setMessage] = useState('Activating your plan…');
  const startTier = useRef<string | null>(null);
  const polled = useRef(false);

  useEffect(() => {
    if (status === 'cancelled' || status === 'failed') {
      setPhase('failed');
      setMessage('Payment was not completed. Returning to subscription…');
      const timer = setTimeout(() => router.replace('/subscription'), 1500);
      return () => clearTimeout(timer);
    }
    if (status && status !== 'successful') {
      setPhase('failed');
      setMessage('Unknown payment status. Returning to subscription…');
      const timer = setTimeout(() => router.replace('/subscription'), 2000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'successful' || !userId || polled.current) return;
    polled.current = true;
    const started = Date.now();
    const client = createClient();
    void client
      .from('users')
      .select(
        'subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber, billing_cycle'
      )
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          startTier.current = deriveSubscriptionState(
            data as Parameters<typeof deriveSubscriptionState>[0]
          ).effectiveTier;
        }
      });
    const interval = setInterval(() => {
      void (async () => {
        const { data } = await client
          .from('users')
          .select(
            'subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber, billing_cycle'
          )
          .eq('id', userId)
          .maybeSingle();
        if (!data) return;
        const next = deriveSubscriptionState(data as Parameters<typeof deriveSubscriptionState>[0]);
        if (startTier.current != null && next.effectiveTier !== startTier.current) {
          clearInterval(interval);
          const label = TIER_META[next.effectiveTier].label;
          setMessage(`You're now on ${label} 🎉`);
          setPhase('success');
          setTimeout(() => router.replace('/subscription'), 2000);
        } else if (Date.now() - started > 30_000) {
          clearInterval(interval);
          setPhase('failed');
          setMessage('Still processing — refresh your subscription page in a moment.');
        }
      })();
    }, 2000);
    return () => clearInterval(interval);
  }, [status, userId, router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="linkup-card max-w-md rounded-2xl p-8 text-center">
        {phase === 'processing' ? (
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        ) : null}
        <h1 className="mt-4 font-display text-xl font-extrabold text-foreground">
          {phase === 'success' ? 'Welcome!' : phase === 'failed' ? 'Almost there' : 'Processing'}
        </h1>
        <p className="mt-2 text-[14px] font-semibold text-muted">{message}</p>
        {phase === 'failed' ? (
          <Link
            href="/subscription"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white"
          >
            Try again
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function SubscriptionCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
