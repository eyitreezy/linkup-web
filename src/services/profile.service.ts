import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbProfile, DbUser } from '@/types/database';

export async function fetchUserProfileBundle(client: SupabaseClient, userId: string) {
  const [profileRes, userRes, createdRes, doneRes] = await Promise.all([
    client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    client.from('users').select('*').eq('id', userId).maybeSingle(),
    client
      .from('plans')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', userId),
    client
      .from('plans')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', userId)
      .eq('status', 'completed'),
  ]);

  return {
    profile: (profileRes.data ?? null) as DbProfile | null,
    dbUser: (userRes.data ?? null) as DbUser | null,
    plansCreated: createdRes.count ?? 0,
    plansDone: doneRes.count ?? 0,
    error: profileRes.error?.message ?? userRes.error?.message ?? null,
  };
}
