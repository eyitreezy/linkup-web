'use client';

import { openEscrowCheckout } from '@/lib/escrow/openEscrowCheckout';
import type { DbEscrowTransaction } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 90_000;

type EscrowRow = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'plan_id'
  | 'status'
  | 'escrow_pattern'
  | 'host_id'
  | 'guest_id'
  | 'payer_id'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'amount_cents'
  | 'host_share_cents'
  | 'guest_share_cents'
>;

function userLegFunded(escrow: EscrowRow, userId: string): boolean {
  if (escrow.escrow_pattern === 'B') {
    if (userId === escrow.host_id) return !!escrow.host_funded_at;
    if (userId === escrow.guest_id) return !!escrow.guest_funded_at;
  }
  return escrow.status !== 'pending_funding';
}

export function useEscrowFunding() {
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollEscrowFunded = useCallback(
    (escrowId: string, userId: string, onFunded?: () => void) => {
      stopPolling();
      const started = Date.now();
      pollRef.current = setInterval(() => {
        void (async () => {
          const client = createClient();
          const { data } = await client
            .from('escrow_transactions')
            .select(
              'id, plan_id, status, escrow_pattern, host_id, guest_id, payer_id, host_funded_at, guest_funded_at, amount_cents, host_share_cents, guest_share_cents'
            )
            .eq('id', escrowId)
            .maybeSingle();
          if (!data) return;
          const row = data as EscrowRow;
          if (userLegFunded(row, userId) || row.status === 'funded' || row.status === 'active') {
            stopPolling();
            onFunded?.();
          } else if (Date.now() - started > POLL_MAX_MS) {
            stopPolling();
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const fundEscrow = useCallback(
    async (
      escrow: EscrowRow,
      userId: string,
      userEmail: string | null | undefined,
      onFunded?: () => void
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!userEmail?.trim()) {
        return { ok: false, error: 'Add an email on your account to pay.' };
      }
      if (escrow.status !== 'pending_funding') {
        return { ok: false, error: 'This escrow is not awaiting payment.' };
      }

      let escrowLeg: 'host' | 'guest' | undefined;
      if (escrow.escrow_pattern === 'B') {
        if (userId === escrow.host_id && !escrow.host_funded_at) {
          escrowLeg = 'host';
        } else if (userId === escrow.guest_id && !escrow.guest_funded_at) {
          escrowLeg = 'guest';
        } else {
          return { ok: false, error: 'No pending share for you on this escrow.' };
        }
      } else if (userId !== escrow.payer_id) {
        return { ok: false, error: 'Only the payer can fund this escrow.' };
      }

      setBusy(true);
      try {
        const result = await openEscrowCheckout({
          escrowId: escrow.id,
          planId: escrow.plan_id,
          escrowLeg,
        });
        if (!result.ok) {
          return { ok: false, error: result.error ?? 'Checkout failed' };
        }
        pollEscrowFunded(escrow.id, userId, onFunded);
        return { ok: true };
      } finally {
        setBusy(false);
      }
    },
    [pollEscrowFunded]
  );

  return { fundEscrow, busy, stopPolling };
}
