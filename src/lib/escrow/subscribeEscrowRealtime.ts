import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  planId?: string;
  escrowId?: string;
  onRefresh: () => void;
};

/** Debounced realtime refresh when escrow rows change (funding, status). */
export function subscribeEscrowRealtime({ planId, escrowId, onRefresh }: Options): () => void {
  if (!planId && !escrowId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onRefresh();
    }, 180);
  };

  const client = createClient();
  const channel: RealtimeChannel = client.channel(
    `escrow-rt:${planId ?? 'x'}:${escrowId ?? 'x'}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );

  if (planId) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'escrow_transactions',
        filter: `plan_id=eq.${planId}`,
      },
      schedule
    );
  }

  if (escrowId) {
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'escrow_transactions',
        filter: `id=eq.${escrowId}`,
      },
      schedule
    );
  }

  channel.subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void client.removeChannel(channel);
  };
}
