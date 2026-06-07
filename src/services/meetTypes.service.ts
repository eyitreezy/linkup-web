import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbMeetType } from '@/types/database';

export async function fetchActiveMeetTypes(client: SupabaseClient) {
  const { data, error } = await client
    .from('meet_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { rows: [] as DbMeetType[], error: error.message };
  return { rows: (data ?? []) as DbMeetType[], error: null };
}
