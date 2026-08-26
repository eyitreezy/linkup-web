import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  escrowCheckoutInitiator,
  escrowUserPaymentVerified,
  type EscrowFundingRow,
} from '@/lib/escrow/escrowFundingStatus';
import { invokeVerifyEscrowPayment } from '@/lib/escrow/verifyEscrowPayment';

export type EscrowConfirmationStatus = 'idle' | 'polling' | 'verified' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const VERIFY_AFTER_MS = 3000;
const TIMEOUT_MS = 90000;

const ESCROW_FUNDING_SELECT =
  'status, escrow_pattern, host_id, guest_id, payer_id, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents, metadata';

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
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyInFlightRef = useRef(false);
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
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
    if (verifyRetryTimerRef.current) {
      clearTimeout(verifyRetryTimerRef.current);
      verifyRetryTimerRef.current = null;
    }
  }, []);

  const resolveViewerUserId = useCallback(
    (escrow: EscrowFundingRow | null | undefined): string | null => {
      if (viewerUserId) return viewerUserId;
      return escrowCheckoutInitiator(escrow);
    },
    [viewerUserId]
  );

  const isPaymentVerified = useCallback(
    (escrow: EscrowFundingRow | null | undefined): boolean => {
      if (!escrow) return false;
      const userId = resolveViewerUserId(escrow);
      return escrowUserPaymentVerified(escrow, userId);
    },
    [resolveViewerUserId]
  );

  const fetchEscrowFunding = useCallback(async (): Promise<EscrowFundingRow | null> => {
    if (!escrowId) return null;
    const { data } = await client
      .from('escrow_transactions')
      .select(ESCROW_FUNDING_SELECT)
      .eq('id', escrowId)
      .maybeSingle();
    return (data as EscrowFundingRow | null) ?? null;
  }, [client, escrowId]);

  const markVerified = useCallback(() => {
    cleanup();
    setStatus('verified');
    onVerifiedRef.current?.();
  }, [cleanup]);

  const callVerifyEndpoint = useCallback(async (): Promise<boolean> => {
    if (!escrowId || verifyInFlightRef.current) return false;
    verifyInFlightRef.current = true;
    try {
      const result = await invokeVerifyEscrowPayment(client, escrowId, txRef ?? undefined);
      if (result.funded) {
        markVerified();
        return true;
      }
      const escrow = await fetchEscrowFunding();
      if (isPaymentVerified(escrow)) {
        markVerified();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[escrow-confirm] verify endpoint error:', err);
      const escrow = await fetchEscrowFunding();
      if (isPaymentVerified(escrow)) {
        markVerified();
        return true;
      }
      return false;
    } finally {
      verifyInFlightRef.current = false;
    }
  }, [client, escrowId, fetchEscrowFunding, isPaymentVerified, markVerified, txRef]);

  const retryVerify = useCallback(async (): Promise<boolean> => {
    if (!escrowId) return false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const escrow = await fetchEscrowFunding();
      if (isPaymentVerified(escrow)) {
        markVerified();
        return true;
      }

      const verified = await callVerifyEndpoint();
      if (verified) return true;

      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return false;
  }, [callVerifyEndpoint, escrowId, fetchEscrowFunding, isPaymentVerified, markVerified]);

  useEffect(() => {
    if (!enabled || !escrowId) {
      cleanup();
      setStatus('idle');
      setSecondsElapsed(0);
      return;
    }

    setStatus('polling');
    setSecondsElapsed(0);

    void fetchEscrowFunding().then((escrow) => {
      if (isPaymentVerified(escrow)) markVerified();
    });

    pollRef.current = setInterval(() => {
      void fetchEscrowFunding().then((escrow) => {
        if (isPaymentVerified(escrow)) markVerified();
      });
    }, POLL_INTERVAL_MS);

    verifyTimerRef.current = setTimeout(() => {
      void callVerifyEndpoint();
    }, VERIFY_AFTER_MS);

    const scheduleVerifyRetry = () => {
      verifyRetryTimerRef.current = setTimeout(() => {
        void callVerifyEndpoint().finally(() => {
          verifyRetryTimerRef.current = setTimeout(scheduleVerifyRetry, 15000);
        });
      }, 15000);
    };
    scheduleVerifyRetry();

    timeoutRef.current = setTimeout(() => {
      cleanup();
      setStatus((current) => (current === 'verified' ? 'verified' : 'timeout'));
    }, TIMEOUT_MS);

    const ticker = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);

    return () => {
      cleanup();
      clearInterval(ticker);
    };
  }, [
    callVerifyEndpoint,
    cleanup,
    enabled,
    escrowId,
    fetchEscrowFunding,
    isPaymentVerified,
    markVerified,
  ]);

  return { status, secondsElapsed, retryVerify, callVerifyEndpoint };
}
