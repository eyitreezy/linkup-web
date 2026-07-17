'use client';

import { useEscrowConfirmation } from '@/hooks/useEscrowConfirmation';
import { invokeVerifyEscrowPayment } from '@/lib/escrow/verifyEscrowPayment';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { IoHourglassOutline } from 'react-icons/io5';

function parseEscrowId(searchParams: URLSearchParams): string | null {
  const direct = searchParams.get('escrow_id');
  if (direct) return direct;
  const txRef = searchParams.get('tx_ref');
  if (!txRef) return null;
  const parts = txRef.split('_');
  if (parts.length >= 3 && parts[0] === 'linkup' && parts[1] === 'esc') {
    return parts[2] ?? null;
  }
  return null;
}

function EscrowCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get('status');
  const txRef = searchParams.get('tx_ref');
  const escrowId = parseEscrowId(searchParams);
  const [checkBusy, setCheckBusy] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);

  const client = useMemo(() => createClient(), []);

  const confirmEnabled = status === 'successful' && !!escrowId;

  const onVerified = useCallback(() => {
    if (escrowId) {
      router.replace(`/escrow/${escrowId}`);
    }
  }, [escrowId, router]);

  const { status: confirmationStatus, secondsElapsed, retryVerify } = useEscrowConfirmation(
    client,
    escrowId ?? undefined,
    {
      enabled: confirmEnabled,
      txRef,
      onVerified,
    }
  );

  useEffect(() => {
    if (!escrowId) return;
    void client
      .from('escrow_transactions')
      .select('plan_id')
      .eq('id', escrowId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.plan_id) setPlanId(data.plan_id as string);
      });
  }, [client, escrowId]);

  useEffect(() => {
    if (status === 'cancelled' || status === 'failed') {
      const timer = setTimeout(() => {
        if (escrowId) router.replace(`/escrow/${escrowId}`);
        else router.replace('/offers');
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (status && status !== 'successful') {
      const timer = setTimeout(() => {
        if (escrowId) router.replace(`/escrow/${escrowId}`);
        else router.replace('/offers');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, escrowId, router]);

  async function onCheckAgain() {
    if (!escrowId) return;
    setCheckBusy(true);
    try {
      const funded = await retryVerify();
      if (!funded) {
        const result = await invokeVerifyEscrowPayment(client, escrowId, txRef ?? undefined);
        if (result.funded) {
          router.replace(`/escrow/${escrowId}`);
        } else if (planId) {
          router.replace(`/plan/${planId}`);
        } else {
          router.replace(`/support?ref=payment_delayed&escrow=${escrowId}`);
        }
      }
    } finally {
      setCheckBusy(false);
    }
  }

  if (status === 'cancelled' || status === 'failed') {
    return (
      <CallbackShell
        phase="failed"
        title="Almost there"
        message="Payment was not completed."
        escrowId={escrowId}
      />
    );
  }

  if (status && status !== 'successful') {
    return (
      <CallbackShell
        phase="failed"
        title="Almost there"
        message="Unknown payment status."
        escrowId={escrowId}
      />
    );
  }

  if (confirmationStatus === 'verified') {
    return null;
  }

  if (confirmationStatus === 'timeout') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <div className="linkup-card relative max-w-md overflow-hidden rounded-3xl p-8 text-center shadow-lg">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent"
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-4">
            <IoHourglassOutline size={48} className="text-amber-500" />
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
              Secure payment
            </p>
            <h1 className="font-display text-2xl font-extrabold text-foreground">
              Taking longer than expected
            </h1>
            <p className="text-[14px] font-semibold leading-relaxed text-muted">
              Your payment was received by Flutterwave. We&apos;re still waiting for the
              confirmation to reach us. This can occasionally take a minute.
            </p>
            <button
              type="button"
              onClick={() => void onCheckAgain()}
              disabled={checkBusy}
              className="w-full max-w-xs rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
            >
              {checkBusy ? 'Checking…' : 'Check again'}
            </button>
            {planId ? (
              <button
                type="button"
                onClick={() => router.replace(`/plan/${planId}`)}
                className="text-[14px] font-semibold text-muted hover:text-foreground"
              >
                Return to plan
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="linkup-card relative max-w-md overflow-hidden rounded-3xl p-8 text-center shadow-lg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent"
          aria-hidden
        />
        <div className="relative">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-secondary">
            Secure payment
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground">Processing</h1>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
            Your Flutterwave payment is being applied.
            {secondsElapsed > 8
              ? ' This is taking a moment. Please wait.'
              : ' This usually takes a few seconds.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function CallbackShell({
  phase,
  title,
  message,
  escrowId,
}: {
  phase: 'failed';
  title: string;
  message: string;
  escrowId: string | null;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="linkup-card relative max-w-md overflow-hidden rounded-3xl p-8 text-center shadow-lg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent"
          aria-hidden
        />
        <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDE8FF]/80">
            <IoHourglassOutline size={40} className="text-amber-500" />
            </div>
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-secondary">
            Secure payment
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground">{title}</h1>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">{message}</p>
          {phase === 'failed' && escrowId ? (
            <Link
              href={`/escrow/${escrowId}`}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white"
            >
              Back to escrow
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function EscrowCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
        </div>
      }
    >
      <EscrowCallbackContent />
    </Suspense>
  );
}
