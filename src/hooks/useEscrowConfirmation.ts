import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchEscrowFundingRow,
  fetchEscrowFundingVerified,
} from '@/lib/escrow/fetchEscrowFundingStatus';
import {
  escrowCheckoutInitiator,
  escrowUserPaymentVerified,
  type EscrowFundingRow,
} from '@/lib/escrow/escrowFundingStatus';
import { invokeVerifyEscrowPayment } from '@/lib/escrow/verifyEscrowPayment';

export type EscrowConfirmationStatus = 'idle' | 'polling' | 'verified' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const VERIFY_RETRY_MS = 8000;
const TIMEOUT_MS = 90000;

type Options = {
  enabled?: boolean;
  txRef?: string | null;
  /** When set, partial split-leg funding counts as verified for this payer. */
  viewerUserId?: string | null;
  onVerified?: () => void;
};

export function useEscrowConfirmation(
  client: SupabaseClient,
  escrowId: string | undefined,
  opts?: Options
) {
  const enabled = opts?.enabled ?? false;
  const txRef = opts?.txRef ?? null;
  const viewerUserId = opts?.viewerUserId ?? null;
  const onVerified = opts?.onVerified;

  const [status, setStatus] = useState<EscrowConfirmationStatus>('idle');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyInFlightRef = useRef(false);
  const verifiedRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (verifyRetryTimerRef.current) {
      clearTimeout(verifyRetryTimerRef.current);
      verifyRetryTimerRef.current = null;
    }
  }, []);

  const markVerified = useCallback(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    cleanup();
    setStatus('verified');
    onVerifiedRef.current?.();
  }, [cleanup]);

  const isPaymentVerified = useCallback(
    (escrow: EscrowFundingRow | null | undefined, userId: string | null): boolean => {
      return escrowUserPaymentVerified(escrow, userId);
    },
    []
  );

  const checkFundingState = useCallback(async (): Promise<boolean> => {
    if (!escrowId || verifiedRef.current) return false;

    const userId = viewerUserId ?? null;
    const verified = await fetchEscrowFundingVerified(client, escrowId, userId);
    if (verified) {
      markVerified();
      return true;
    }

    const escrow = await fetchEscrowFundingRow(client, escrowId);
    const resolvedUserId = userId ?? escrowCheckoutInitiator(escrow);
    if (isPaymentVerified(escrow, resolvedUserId)) {
      markVerified();
      return true;
    }
    return false;
  }, [client, escrowId, isPaymentVerified, markVerified, viewerUserId]);

  const callVerifyEndpoint = useCallback(async (): Promise<boolean> => {
    if (!escrowId || verifyInFlightRef.current || verifiedRef.current) return false;
    verifyInFlightRef.current = true;
    try {
      const result = await invokeVerifyEscrowPayment(client, escrowId, txRef ?? undefined);
      if (result.funded) {
        markVerified();
        return true;
      }
      return await checkFundingState();
    } catch (err) {
      console.error('[escrow-confirm] verify endpoint error:', err);
      return await checkFundingState();
    } finally {
      verifyInFlightRef.current = false;
    }
  }, [checkFundingState, client, escrowId, markVerified, txRef]);

  const retryVerify = useCallback(async (): Promise<boolean> => {
    if (!escrowId) return false;

    verifiedRef.current = false;
    setStatus('polling');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const funded = await checkFundingState();
      if (funded) return true;

      const verified = await callVerifyEndpoint();
      if (verified) return true;

      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setStatus('timeout');
    return false;
  }, [callVerifyEndpoint, checkFundingState, escrowId]);

  useEffect(() => {
    if (!enabled || !escrowId) {
      cleanup();
      verifiedRef.current = false;
      setStatus('idle');
      setSecondsElapsed(0);
      return;
    }

    verifiedRef.current = false;
    setStatus('polling');
    setSecondsElapsed(0);

    void checkFundingState();
    void callVerifyEndpoint();

    pollRef.current = setInterval(() => {
      void checkFundingState();
    }, POLL_INTERVAL_MS);

    const scheduleVerifyRetry = () => {
      verifyRetryTimerRef.current = setTimeout(() => {
        void callVerifyEndpoint().finally(() => {
          if (!verifiedRef.current) scheduleVerifyRetry();
        });
      }, VERIFY_RETRY_MS);
    };
    scheduleVerifyRetry();

    timeoutRef.current = setTimeout(() => {
      if (verifiedRef.current) return;
      cleanup();
      setStatus('timeout');
    }, TIMEOUT_MS);

    const ticker = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);

    const channel = client
      .channel(`escrow-confirm-${escrowId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escrow_transactions',
          filter: `id=eq.${escrowId}`,
        },
        () => {
          void checkFundingState();
        }
      )
      .subscribe();

    return () => {
      cleanup();
      clearInterval(ticker);
      void client.removeChannel(channel);
    };
  }, [callVerifyEndpoint, checkFundingState, cleanup, client, enabled, escrowId]);

  return { status, secondsElapsed, retryVerify, callVerifyEndpoint };
}
