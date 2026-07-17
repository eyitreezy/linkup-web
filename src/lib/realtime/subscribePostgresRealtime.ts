'use client';

import { createClient } from '@/lib/supabase/client';

const DEBOUNCE_MS = 180;

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type PostgresRealtimeTarget = {
  table: string;
  event?: PostgresEvent;
  filter?: string;
};

type Options = {
  debounceMs?: number;
  channelPrefix?: string;
};

function uniqueChannel(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Debounced postgres_changes subscription(s).
 * Tables must be in supabase_realtime publication (see migrations).
 */
export function subscribePostgresRealtime(
  onChange: () => void,
  targets: PostgresRealtimeTarget | PostgresRealtimeTarget[],
  options?: Options
): () => void {
  const client = createClient();
  const list = Array.isArray(targets) ? targets : [targets];
  const debounceMs = options?.debounceMs ?? DEBOUNCE_MS;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const fire = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(onChange, debounceMs);
  };

  let channel = client.channel(uniqueChannel(options?.channelPrefix ?? 'pg-rt'));
  for (const target of list) {
    channel = channel.on(
      'postgres_changes',
      {
        event: target.event ?? '*',
        schema: 'public',
        table: target.table,
        ...(target.filter ? { filter: target.filter } : {}),
      },
      fire
    );
  }
  channel.subscribe();

  return () => {
    if (debounce) clearTimeout(debounce);
    void client.removeChannel(channel);
  };
}
