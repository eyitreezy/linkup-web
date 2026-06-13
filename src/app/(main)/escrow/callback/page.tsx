'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { IoCheckmarkCircle, IoHourglassOutline, IoWalletOutline } from 'react-icons/io5';

function parseEscrowId(searchParams: URLSearchParams): string | null {
  const direct = searchParams.get('escrow_id');
  if (direct) return direct;
  const txRef = searchParams.get('tx_ref');
  if (!txRef) return null;
  const parts = txRef.split('_');
  if (parts.length >= 3 && parts[0] === 'linkup' && parts[1] === 'escrow') {
    return parts[2] ?? null;
  }
  return null;
}

function EscrowCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get('status');
  const escrowId = parseEscrowId(searchParams);
  const [phase, setPhase] = useState<'processing' | 'success' | 'partial' | 'failed'>('processing');
  const [message, setMessage] = useState('Confirming your payment with Flutterwave…');
  const polled = useRef(false);

  useEffect(() => {
    if (status === 'cancelled' || status === 'failed') {
      setPhase('failed');
      setMessage('Payment was not completed.');
      const timer = setTimeout(() => {
        if (escrowId) router.replace(`/escrow/${escrowId}`);
        else router.replace('/offers');
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (status && status !== 'successful') {
      setPhase('failed');
      setMessage('Unknown payment status.');
      const timer = setTimeout(() => {
        if (escrowId) router.replace(`/escrow/${escrowId}`);
        else router.replace('/offers');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, escrowId, router]);

  useEffect(() => {
    if (status !== 'successful' || !escrowId || polled.current) return;
    polled.current = true;
    const started = Date.now();
    const client = createClient();

    const interval = setInterval(() => {
      void (async () => {
        const { data } = await client
          .from('escrow_transactions')
          .select('status, host_funded_at, guest_funded_at, escrow_pattern')
          .eq('id', escrowId)
          .maybeSingle();
        if (!data) return;

        const fullyFunded = data.status === 'funded' || data.status === 'active';
        const partial =
          data.escrow_pattern === 'B' &&
          (data.host_funded_at || data.guest_funded_at) &&
          !fullyFunded;

        if (fullyFunded) {
          clearInterval(interval);
          setPhase('success');
          setMessage('Payment confirmed — escrow is funded and held securely.');
          setTimeout(() => router.replace(`/escrow/${escrowId}`), 1500);
        } else if (partial) {
          clearInterval(interval);
          setPhase('partial');
          setMessage('Your share is funded — waiting for the other party.');
          setTimeout(() => router.replace(`/escrow/${escrowId}`), 1500);
        } else if (Date.now() - started > 30_000) {
          clearInterval(interval);
          setPhase('failed');
          setMessage('Still processing — check your escrow page in a moment.');
        }
      })();
    }, 2000);

    return () => clearInterval(interval);
  }, [status, escrowId, router]);

  const icon =
    phase === 'success' ? (
      <IoCheckmarkCircle size={40} className="text-emerald-500" />
    ) : phase === 'partial' ? (
      <IoWalletOutline size={40} className="text-primary" />
    ) : phase === 'failed' ? (
      <IoHourglassOutline size={40} className="text-amber-500" />
    ) : null;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="linkup-card relative max-w-md overflow-hidden rounded-3xl p-8 text-center shadow-lg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent"
          aria-hidden
        />
        <div className="relative">
          {phase === 'processing' ? (
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDE8FF]/80">
              {icon}
            </div>
          )}
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-secondary">
            Secure payment
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground">
            {phase === 'success'
              ? 'Funded!'
              : phase === 'partial'
                ? 'Share funded'
                : phase === 'failed'
                  ? 'Almost there'
                  : 'Processing'}
          </h1>
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
