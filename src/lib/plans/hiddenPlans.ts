import type { SupabaseClient } from '@supabase/supabase-js';

const HIDDEN_CAP = 200;

export async function fetchHiddenPlanIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from('hidden_plans')
    .select('plan_id')
    .eq('user_id', userId)
    .order('hidden_at', { ascending: false })
    .limit(HIDDEN_CAP);
  if (error) return [];
  return (data ?? []).map((r) => r.plan_id as string);
}

export function persistHiddenPlan(client: SupabaseClient, userId: string, planId: string): void {
  void client
    .from('hidden_plans')
    .upsert({ user_id: userId, plan_id: planId }, { onConflict: 'user_id,plan_id' });
}

export function removeHiddenPlan(client: SupabaseClient, userId: string, planId: string): void {
  void client.from('hidden_plans').delete().eq('user_id', userId).eq('plan_id', planId);
}
