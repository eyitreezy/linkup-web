'use client';

import { TIER_META } from '@/lib/subscription/constants';
import { clearSubscriptionCheckoutTxRef, loadSubscriptionCheckoutTxRef } from '@/lib/subscription/subscriptionCheckoutSession';
import { invokeConfirmSubscriptionPayment } from '@/lib/subscription/verifySubscriptionPayment';
import { clearPermissionCache } from '@/lib/subscription/checkPermission';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoHourglassOutline } from 'react-icons/io5';

type Phase = 'processing' | 'success' | 'failed' | 'timeout';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const status = searchParams.get('status');
  const txRefFromUrl = searchParams.get('tx_ref');
  const [phase, setPhase] = useState<Phase>('processing');
  const [message, setMessage] = useState('Activating your plan…');
  const [checkBusy, setCheckBusy] = useState(false);
  const startedRef = useRef(false);
  const client = useMemo(() => createClient(), []);

  const txRef = txRefFromUrl?.trim() || loadSubscriptionCheckoutTxRef();

  const runConfirmation = useCallback(async (): Promise<boolean> => {
    if (!userId || !txRef) return false;

    const result = await invokeConfirmSubscriptionPayment(client, txRef);
    if (result.activated) {
      clearSubscriptionCheckoutTxRef();
      clearPermissionCache();
      const tierKey = (result.tier ?? 'SILVER') as keyof typeof TIER_META;
      const label = TIER_META[tierKey]?.label ?? 'your plan';
      setMessage(`You're now on ${label} 🎉`);
      setPhase('success');
      window.setTimeout(() => router.replace('/subscription'), 2000);
      return true;
    }

    return false;
  }, [client, router, txRef, userId]);

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
    if (status !== 'successful' || !userId || startedRef.current) return;
    if (!txRef) {
      setPhase('failed');
      setMessage('Missing payment reference. Open subscription history or try again.');
      return;
    }

    startedRef.current = true;
    const started = Date.now();
    let interval: number | null = null;

    void (async () => {
      const immediate = await runConfirmation();
      if (immediate) return;

      interval = window.setInterval(() => {
        void (async () => {
          const ok = await runConfirmation();
          if (ok) {
            if (interval) window.clearInterval(interval);
            return;
          }
          if (Date.now() - started > 45_000) {
            if (interval) window.clearInterval(interval);
            setPhase('timeout');
            setMessage(
              'Your payment was received by Flutterwave. We are still waiting for confirmation — tap Check again in a moment.'
            );
          }
        })();
      }, 2500);
    })();

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [runConfirmation, status, txRef, userId]);

  async function onCheckAgain() {
    if (!txRef) return;
    setCheckBusy(true);
    try {
      const ok = await runConfirmation();
      if (!ok) {
        setPhase('timeout');
        setMessage(
          'Still processing. If you were charged, your plan should appear shortly — refresh the subscription page or contact support.'
        );
      }
    } finally {
      setCheckBusy(false);
    }
  }

  if (phase === 'timeout') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <div className="linkup-card max-w-md rounded-2xl p-8 text-center">
          <IoHourglassOutline className="mx-auto text-amber-500" size={48} />
          <h1 className="mt-4 font-display text-xl font-extrabold text-foreground">Almost there</h1>
          <p className="mt-2 text-[14px] font-semibold text-muted">{message}</p>
          <button
            type="button"
            onClick={() => void onCheckAgain()}
            disabled={checkBusy}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white disabled:opacity-60"
          >
            {checkBusy ? 'Checking…' : 'Check again'}
          </button>
          <Link
            href="/subscription"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center text-[14px] font-semibold text-muted hover:text-foreground"
          >
            Back to subscription
          </Link>
        </div>
      </div>
    );
  }

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
