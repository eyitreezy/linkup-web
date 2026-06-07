import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbMeetType, DbPlan, DbProfile } from '@/types/database';

type CreatorProfile = Pick<
  DbProfile,
  | 'display_name'
  | 'avatar_url'
  | 'primary_photo_url'
  | 'photo_urls'
  | 'verified_badge'
  | 'ai_trust_score'
  | 'preferences'
>;

export type PlanFeedRow = DbPlan & {
  meet_types?: DbMeetType | null;
  creator?: CreatorProfile | null;
};

const CREATOR_PROFILE_FIELDS =
  'user_id, display_name, avatar_url, primary_photo_url, photo_urls, verified_badge, ai_trust_score, preferences';

type ProfileRow = Pick<
  DbProfile,
  | 'user_id'
  | 'display_name'
  | 'avatar_url'
  | 'primary_photo_url'
  | 'photo_urls'
  | 'verified_badge'
  | 'ai_trust_score'
  | 'preferences'
>;

async function fetchProfilesForCreators(
  client: SupabaseClient,
  creatorIds: string[]
): Promise<Map<string, CreatorProfile>> {
  const unique = [...new Set(creatorIds)].filter(Boolean);
  const map = new Map<string, CreatorProfile>();
  if (unique.length === 0) return map;

  const { data, error } = await client.from('profiles').select(CREATOR_PROFILE_FIELDS).in('user_id', unique);
  if (error || !data) return map;

  for (const row of data as ProfileRow[]) {
    const { user_id: _uid, ...profile } = row;
    map.set(row.user_id, profile);
  }
  return map;
}

function attachCreators(plans: (DbPlan & { meet_types?: DbMeetType | null })[], profiles: Map<string, CreatorProfile>): PlanFeedRow[] {
  return plans.map((p) => ({
    ...p,
    creator: profiles.get(p.creator_id) ?? null,
  }));
}

/**
 * Public discovery feed — mirrors mobile `fetchPlansPage` (no invalid plans→profiles FK embed).
 */
export async function fetchDiscoverPlans(
  client: SupabaseClient,
  opts?: { limit?: number }
) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const viewerUserId = user?.id ?? null;

  const nowIso = new Date().toISOString();
  const nowQuoted = `"${nowIso}"`;
  const moodOr = viewerUserId
    ? `is_mood_plan.eq.false,mood_expires_at.is.null,creator_id.eq.${viewerUserId},mood_expires_at.gt.${nowQuoted}`
    : `is_mood_plan.eq.false,mood_expires_at.is.null,mood_expires_at.gt.${nowQuoted}`;
  const notExpiredOr = viewerUserId
    ? `is_expired.eq.false,creator_id.eq.${viewerUserId}`
    : `is_expired.eq.false`;

  let q = client
    .from('plans')
    .select('*, meet_types(*)')
    .eq('is_suppressed', false)
    .is('archived_at', null)
    .in('status', ['negotiating', 'active'])
    .or(moodOr)
    .or(notExpiredOr);

  if (viewerUserId) {
    q = q.or(`visibility.eq.public,visibility.eq.radius,creator_id.eq.${viewerUserId}`);
  } else {
    q = q.in('visibility', ['public', 'radius']);
  }

  const limit = opts?.limit ?? 48;
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);

  if (error) return { data: [] as PlanFeedRow[], error };

  const plans = (data ?? []) as (DbPlan & { meet_types?: DbMeetType | null })[];
  const profiles = await fetchProfilesForCreators(
    client,
    plans.map((p) => p.creator_id)
  );
  return { data: attachCreators(plans, profiles), error: null };
}

export async function fetchPlanById(client: SupabaseClient, planId: string) {
  const { data: plan, error: planError } = await client
    .from('plans')
    .select('*, meet_types(*)')
    .eq('id', planId)
    .maybeSingle();

  if (planError) return { data: null, error: planError };
  if (!plan) return { data: null, error: null };

  const row = plan as DbPlan & { meet_types?: DbMeetType | null };
  const profiles = await fetchProfilesForCreators(client, [row.creator_id]);
  const feedRow: PlanFeedRow = {
    ...row,
    creator: profiles.get(row.creator_id) ?? null,
  };
  return { data: feedRow, error: null };
}
