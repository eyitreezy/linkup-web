import type { SupabaseClient } from '@supabase/supabase-js';

export async function findGroupChatIdForPlan(
  client: SupabaseClient,
  planId: string
): Promise<string | null> {
  const { data, error } = await client
    .from('conversations')
    .select('id')
    .eq('plan_id', planId)
    .eq('is_group_chat', true)
    .maybeSingle();

  if (error) return null;
  return (data?.id as string | undefined) ?? null;
}
