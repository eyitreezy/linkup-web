import { buildDuplicatePlanNormalizationPatch } from '@/lib/plans/planDuplicate';
import type { CreatorPlanRow } from '@/lib/plans/planManagement';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CreatorPlanStats = {
  offersCountByPlan: Record<string, number>;
  viewsByPlan: Record<string, number>;
  savesByPlan: Record<string, number>;
  latestEngagementAt: Record<string, string>;
};

export async function fetchCreatorPlans(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('plans')
    .select('*, meet_types(*)')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { plans: [] as CreatorPlanRow[], error: error.message };
  return { plans: (data ?? []) as CreatorPlanRow[], error: null };
}

export async function fetchCreatorPlanStats(
  client: SupabaseClient,
  planIds: string[]
): Promise<CreatorPlanStats> {
  if (planIds.length === 0) {
    return { offersCountByPlan: {}, viewsByPlan: {}, savesByPlan: {}, latestEngagementAt: {} };
  }

  const [{ data: eng }, { data: offAgg }] = await Promise.all([
    client
      .from('plan_engagements')
      .select('plan_id, kind, created_at')
      .in('plan_id', planIds)
      .in('kind', ['view', 'save']),
    client.from('plan_offers').select('plan_id').in('plan_id', planIds),
  ]);

  const views: Record<string, number> = {};
  const saves: Record<string, number> = {};
  const latestEngagementAt: Record<string, string> = {};

  for (const r of eng ?? []) {
    const row = r as { plan_id: string; kind: string; created_at: string };
    if (row.kind === 'view') {
      views[row.plan_id] = (views[row.plan_id] ?? 0) + 1;
    } else if (row.kind === 'save') {
      saves[row.plan_id] = (saves[row.plan_id] ?? 0) + 1;
    }

    const existing = latestEngagementAt[row.plan_id];
    if (!existing || new Date(row.created_at).getTime() > new Date(existing).getTime()) {
      latestEngagementAt[row.plan_id] = row.created_at;
    }
  }

  const offers: Record<string, number> = {};
  for (const r of offAgg ?? []) {
    const pid = (r as { plan_id: string }).plan_id;
    offers[pid] = (offers[pid] ?? 0) + 1;
  }

  return {
    offersCountByPlan: offers,
    viewsByPlan: views,
    savesByPlan: saves,
    latestEngagementAt,
  };
}

export async function archiveCreatorPlan(client: SupabaseClient, planId: string) {
  return client.from('plans').update({ archived_at: new Date().toISOString() }).eq('id', planId);
}

export async function unarchiveCreatorPlan(client: SupabaseClient, planId: string) {
  return client.from('plans').update({ archived_at: null }).eq('id', planId);
}

export async function deleteCreatorDraft(client: SupabaseClient, planId: string) {
  return client.from('plans').delete().eq('id', planId).eq('status', 'draft');
}

export async function duplicateCreatorPlan(client: SupabaseClient, planId: string) {
  const { plan: source, error: sourceErr } = await fetchCreatorPlanById(client, planId);
  if (sourceErr || !source) {
    return { data: null, error: { message: sourceErr ?? 'Plan not found.' } };
  }

  const { data: newId, error: dupErr } = await client.rpc('duplicate_plan_for_creator', {
    p_plan_id: planId,
  });
  if (dupErr) return { data: newId, error: dupErr };

  const id = typeof newId === 'string' ? newId : newId != null ? String(newId) : null;
  if (!id) return { data: newId, error: dupErr };

  const patch = buildDuplicatePlanNormalizationPatch(source);
  const { error: normErr } = await client.from('plans').update(patch).eq('id', id);
  if (normErr) return { data: newId, error: normErr };

  return { data: newId, error: null };
}

export async function fetchCreatorPlanById(client: SupabaseClient, planId: string) {
  const { data, error } = await client
    .from('plans')
    .select('*, meet_types(*)')
    .eq('id', planId)
    .maybeSingle();

  if (error) return { plan: null as CreatorPlanRow | null, error: error.message };
  if (!data) return { plan: null, error: 'Plan not found.' };
  return { plan: data as CreatorPlanRow, error: null };
}

export async function updateCreatorPlan(
  client: SupabaseClient,
  planId: string,
  patch: Record<string, unknown>
) {
  return client.from('plans').update(patch).eq('id', planId);
}
