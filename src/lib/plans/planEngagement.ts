import {
  fetchViewerPrivacyPrefs,
  shouldSkipPlanViewRecording,
} from '@/lib/plans/incognitoEngagement';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function recordPlanView(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<void> {
  const prefs = await fetchViewerPrivacyPrefs(client, userId);
  if (shouldSkipPlanViewRecording(prefs)) return;

  await client.from('plan_engagements').upsert(
    {
      plan_id: planId,
      user_id: userId,
      kind: 'view',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'plan_id,user_id,kind' }
  );
}

export async function isPlanSaved(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<boolean> {
  const { data } = await client
    .from('plan_engagements')
    .select('id')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .eq('kind', 'save')
    .maybeSingle();
  return !!data?.id;
}
