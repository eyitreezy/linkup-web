'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';

type Options = {
  /** Realtime filter, e.g. `created_by=eq.<userId>` */
  filter?: string;
};

/**
 * Debounced postgres_changes on public.meet_types.
 * Requires meet_types in supabase_realtime publication (migration 20260620000003).
 */
export function subscribeMeetTypesRealtime(onChange: () => void, options?: Options): () => void {
  return subscribePostgresRealtime(
    onChange,
    {
      table: 'meet_types',
      ...(options?.filter ? { filter: options.filter } : {}),
    },
    { channelPrefix: 'meet-types-rt' }
  );
}

/** Admin catalog panel — all meet type changes. */
export function subscribeAdminMeetTypesRealtime(onChange: () => void): () => void {
  return subscribeMeetTypesRealtime(onChange);
}
