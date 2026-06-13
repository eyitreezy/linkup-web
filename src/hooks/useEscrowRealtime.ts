'use client';

import { createClient } from '@/lib/supabase/client';
import type { DbEscrowTransaction } from '@/types/database';
import { useEffect, useRef } from 'react';

type EscrowUpdateHandler = (
  next: DbEscrowTransaction,
  prev: DbEscrowTransaction | null
) => void;

export function useEscrowRealtime(
  escrowId: string,
  onUpdate: EscrowUpdateHandler
): void {
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;
  const prevRef = useRef<DbEscrowTransaction | null>(null);

  useEffect(() => {
    if (!escrowId) return;
    const client = createClient();

    const channel = client
      .channel(`escrow-${escrowId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escrow_transactions',
          filter: `id=eq.${escrowId}`,
        },
        (payload) => {
          const next = payload.new as DbEscrowTransaction;
          handlerRef.current(next, prevRef.current);
          prevRef.current = next;
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [escrowId]);
}
