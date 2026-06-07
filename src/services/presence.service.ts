import { createClient } from '@/lib/supabase/client';
import type { DbUserPresence } from '@/types/database';

export async function fetchPresenceMap(userIds: string[]): Promise<Record<string, DbUserPresence>> {
  if (userIds.length === 0) return {};
  const client = createClient();
  const { data, error } = await client.from('user_presence').select('*').in('user_id', userIds);
  if (error || !data) return {};
  const m: Record<string, DbUserPresence> = {};
  for (const r of data as DbUserPresence[]) {
    m[r.user_id] = r;
  }
  return m;
}
