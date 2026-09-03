import { fetchConnectedCreatorIds } from '@/lib/plans/discoverConnections';
import { rankDiscoveryPlans } from '@/lib/plans/feedRanking';
import {
  discoverPriceFilterBounds,
  hasDiscoverPriceFilter,
  type DiscoverPriceFilter,
} from '@/lib/discovery/discoverPriceFilter';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { DbMeetType, DbPlan, DbProfile, SubscriptionTierDb } from '@/types/database';

export type CreatorProfile = Pick<
  DbProfile,
  | 'display_name'
  | 'avatar_url'
  | 'primary_photo_url'
  | 'photo_urls'
  | 'verified_badge'
  | 'ai_trust_score'
  | 'preferences'
  | 'spotlight_until'
  | 'masked_activity_enabled'
  | 'host_rating_score'
  | 'host_rating_count'
  | 'completed_meetup_count'
> & {
  subscription_tier?: SubscriptionTierDb;
};

export type PlanFeedRow = DbPlan & {
  meet_types?: DbMeetType | null;
  creator?: CreatorProfile | null;
};

const CREATOR_PROFILE_FIELDS =
  'user_id, display_name, avatar_url, primary_photo_url, photo_urls, verified_badge, ai_trust_score, preferences, spotlight_until, masked_activity_enabled, host_rating_score, host_rating_count, completed_meetup_count';

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
  | 'spotlight_until'
  | 'masked_activity_enabled'
  | 'host_rating_score'
  | 'host_rating_count'
  | 'completed_meetup_count'
>;

async function fetchProfilesForCreators(
  client: SupabaseClient,
  creatorIds: string[]
): Promise<Map<string, CreatorProfile>> {
  const unique = [...new Set(creatorIds)].filter(Boolean);
  const map = new Map<string, CreatorProfile>();
  if (unique.length === 0) return map;

  const [{ data, error }, { data: tierRows }] = await Promise.all([
    client.from('profiles').select(CREATOR_PROFILE_FIELDS).in('user_id', unique),
    client.from('users').select('id, subscription_tier').in('id', unique),
  ]);
  if (error || !data) return map;

  const tierByUser = new Map<string, SubscriptionTierDb>();
  for (const u of (tierRows ?? []) as { id: string; subscription_tier?: SubscriptionTierDb }[]) {
    if (u.subscription_tier) tierByUser.set(u.id, u.subscription_tier);
  }

  for (const row of data as ProfileRow[]) {
    const { user_id: _uid, ...profile } = row;
    map.set(row.user_id, {
      ...profile,
      subscription_tier: tierByUser.get(row.user_id),
    });
  }
  return map;
}

function attachCreators(plans: (DbPlan & { meet_types?: DbMeetType | null })[], profiles: Map<string, CreatorProfile>): PlanFeedRow[] {
  return plans.map((p) => ({
    ...p,
    creator: profiles.get(p.creator_id) ?? null,
  }));
}

const PAGE_SIZE = 48;

function normalizePlanMeetTypes(
  plan: DbPlan & { meet_types?: DbMeetType | null | DbMeetType[] }
): DbPlan & { meet_types?: DbMeetType | null } {
  const meetRaw = plan.meet_types as unknown;
  if (Array.isArray(meetRaw)) {
    return { ...plan, meet_types: meetRaw[0] ?? null };
  }
  return { ...plan, meet_types: (plan.meet_types as DbMeetType | null | undefined) ?? null };
}

function passesDiscoverPriceFilterForPlan(
  plan: DbPlan,
  priceFilter?: DiscoverPriceFilter | null
): boolean {
  if (!priceFilter || !hasDiscoverPriceFilter(priceFilter)) return true;
  const { minPriceCents, maxPriceCents } = discoverPriceFilterBounds(priceFilter);
  const price = plan.starting_price_cents ?? 0;
  if (minPriceCents != null && price < minPriceCents) return false;
  if (maxPriceCents != null && price > maxPriceCents) return false;
  return true;
}

function isMatchedAgreedStandardPlanRow(
  plan: DbPlan,
  matchedPlanIds: Set<string>
): boolean {
  return (
    matchedPlanIds.has(plan.id) &&
    plan.status === 'agreed' &&
    !plan.is_group_plan &&
    !plan.is_expired &&
    !plan.is_suppressed
  );
}

/** Plan ids where the viewer is the matched guest on a standard plan. */
export async function fetchViewerMatchedStandardPlanIds(
  client: SupabaseClient,
  viewerUserId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const [{ data: acceptedOffers }, { data: approvedJoins }, { data: myOffers }] =
    await Promise.all([
      client
        .from('plan_offers')
        .select('plan_id')
        .eq('bidder_id', viewerUserId)
        .eq('status', 'accepted'),
      client
        .from('plan_join_requests')
        .select('plan_id')
        .eq('requester_id', viewerUserId)
        .eq('status', 'approved'),
      client.from('plan_offers').select('id').eq('bidder_id', viewerUserId),
    ]);

  for (const row of acceptedOffers ?? []) {
    if (row.plan_id) ids.add(row.plan_id as string);
  }
  for (const row of approvedJoins ?? []) {
    if (row.plan_id) ids.add(row.plan_id as string);
  }

  const offerIds = (myOffers ?? []).map((row) => row.id as string).filter(Boolean);
  if (offerIds.length > 0) {
    const { data: viaAcceptedOfferId } = await client
      .from('plans')
      .select('id')
      .in('accepted_offer_id', offerIds)
      .eq('is_group_plan', false);
    for (const row of viaAcceptedOfferId ?? []) {
      if (row.id) ids.add(row.id as string);
    }
  }

  return [...ids];
}

async function fetchViewerMatchedStandardPlans(
  client: SupabaseClient,
  viewerUserId: string,
  priceFilter?: DiscoverPriceFilter | null
): Promise<(DbPlan & { meet_types?: DbMeetType | null })[]> {
  const matchedPlanIds = new Set(await fetchViewerMatchedStandardPlanIds(client, viewerUserId));
  if (matchedPlanIds.size === 0) return [];

  const plans = new Map<string, DbPlan & { meet_types?: DbMeetType | null }>();

  const [{ data: guestOffers }, { data: approvedJoins }] = await Promise.all([
    client
      .from('plan_offers')
      .select('plans!inner(*, meet_types(*))')
      .eq('bidder_id', viewerUserId)
      .eq('status', 'accepted'),
    client
      .from('plan_join_requests')
      .select('plans!inner(*, meet_types(*))')
      .eq('requester_id', viewerUserId)
      .eq('status', 'approved'),
  ]);

  const embedRows = [...(guestOffers ?? []), ...(approvedJoins ?? [])];
  for (const row of embedRows) {
    const raw = row.plans as unknown as
      | (DbPlan & { meet_types?: DbMeetType | null | DbMeetType[] })
      | null;
    if (!raw?.id || !matchedPlanIds.has(raw.id)) continue;
    if (!isMatchedAgreedStandardPlanRow(raw, matchedPlanIds)) continue;
    if (raw.is_suppressed || raw.archived_at) continue;
    if (!passesDiscoverPriceFilterForPlan(raw, priceFilter)) continue;
    plans.set(raw.id, normalizePlanMeetTypes(raw));
  }

  const missingIds = [...matchedPlanIds].filter((id) => !plans.has(id));
  if (missingIds.length > 0) {
    const { data: directPlans } = await client
      .from('plans')
      .select('*, meet_types(*)')
      .in('id', missingIds)
      .eq('is_suppressed', false)
      .is('archived_at', null)
      .eq('is_group_plan', false)
      .eq('status', 'agreed');

    for (const raw of directPlans ?? []) {
      const plan = normalizePlanMeetTypes(raw as DbPlan & { meet_types?: DbMeetType | null | DbMeetType[] });
      if (!isMatchedAgreedStandardPlanRow(plan, matchedPlanIds)) continue;
      if (!passesDiscoverPriceFilterForPlan(plan, priceFilter)) continue;
      plans.set(plan.id, plan);
    }
  }

  return [...plans.values()];
}

function mergeDiscoverPlans(
  primary: (DbPlan & { meet_types?: DbMeetType | null })[],
  matched: (DbPlan & { meet_types?: DbMeetType | null })[]
): (DbPlan & { meet_types?: DbMeetType | null })[] {
  if (matched.length === 0) return primary;
  const seen = new Set(primary.map((plan) => plan.id));
  const merged = [...primary];
  for (const plan of matched) {
    if (!seen.has(plan.id)) {
      merged.push(plan);
      seen.add(plan.id);
    }
  }
  return merged;
}

async function discoverPlansQuery(
  client: SupabaseClient,
  viewerUserId: string | null,
  range?: { from: number; to: number },
  priceFilter?: DiscoverPriceFilter | null
) {
  const nowIso = new Date().toISOString();
  const nowQuoted = `"${nowIso}"`;
  const moodOr = viewerUserId
    ? `is_mood_plan.eq.false,mood_expires_at.is.null,creator_id.eq.${viewerUserId},mood_expires_at.gt.${nowQuoted}`
    : `is_mood_plan.eq.false,mood_expires_at.is.null,mood_expires_at.gt.${nowQuoted}`;
  const notExpiredOr = viewerUserId
    ? `is_expired.eq.false,creator_id.eq.${viewerUserId}`
    : `is_expired.eq.false`;

  const activeWindowOr = viewerUserId
    ? `is_mood_plan.eq.true,active_expires_at.is.null,creator_id.eq.${viewerUserId},active_expires_at.gt.${nowQuoted}`
    : `is_mood_plan.eq.true,active_expires_at.is.null,active_expires_at.gt.${nowQuoted}`;

  let connectedCreatorIds: string[] = [];
  if (viewerUserId) {
    try {
      connectedCreatorIds = await fetchConnectedCreatorIds(client, viewerUserId);
    } catch {
      connectedCreatorIds = [];
    }
  }

  let q = client
    .from('plans')
    .select('*, meet_types(*)')
    .eq('is_suppressed', false)
    .is('archived_at', null)
    .in('status', ['negotiating', 'awaiting_payment'])
    .or(moodOr)
    .or(notExpiredOr)
    .or(activeWindowOr);

  if (viewerUserId) {
    const visParts = ['visibility.eq.public', 'visibility.eq.radius', `creator_id.eq.${viewerUserId}`];
    if (connectedCreatorIds.length > 0) {
      visParts.push(`and(visibility.eq.friends,creator_id.in.(${connectedCreatorIds.join(',')}))`);
    }
    q = q.or(visParts.join(','));
  } else {
    q = q.in('visibility', ['public', 'radius']);
  }

  if (priceFilter && hasDiscoverPriceFilter(priceFilter)) {
    const { minPriceCents, maxPriceCents } = discoverPriceFilterBounds(priceFilter);
    if (minPriceCents != null) {
      q = q.gte('starting_price_cents', minPriceCents);
    }
    if (maxPriceCents != null) {
      q = q.lte('starting_price_cents', maxPriceCents);
    }
  }

  q = q
    .order('host_tier_rank', { ascending: false, nullsFirst: false })
    .order('boosted_until', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (range) {
    return q.range(range.from, range.to);
  }
  return q.limit(PAGE_SIZE);
}

/**
 * Public discovery feed — mirrors mobile `fetchPlansPage` (no invalid plans→profiles FK embed).
 */
export async function fetchDiscoverPlans(
  client: SupabaseClient,
  opts?: {
    limit?: number;
    viewerLat?: number | null;
    viewerLng?: number | null;
    priceFilter?: DiscoverPriceFilter | null;
  }
) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const viewerUserId = user?.id ?? null;
  const limit = opts?.limit ?? PAGE_SIZE;

  const { data, error } = await discoverPlansQuery(
    client,
    viewerUserId,
    undefined,
    opts?.priceFilter
  );

  if (error) return { data: [] as PlanFeedRow[], error };

  let plans = ((data ?? []) as (DbPlan & { meet_types?: DbMeetType | null })[]).slice(0, limit);
  if (viewerUserId) {
    const matched = await fetchViewerMatchedStandardPlans(client, viewerUserId, opts?.priceFilter);
    plans = mergeDiscoverPlans(plans, matched);
  }
  const profiles = await fetchProfilesForCreators(
    client,
    plans.map((p) => p.creator_id)
  );
  const rows = attachCreators(plans, profiles);
  return {
    data: rankDiscoveryPlans(rows, {
      effectiveLat: opts?.viewerLat ?? null,
      effectiveLng: opts?.viewerLng ?? null,
    }),
    error: null,
  };
}

export async function fetchDiscoverPlansPage(
  client: SupabaseClient,
  from: number,
  to: number,
  opts?: {
    viewerUserId?: string | null;
    /** Client re-sorts via applyDiscoverFilters — avoid double rank + coord-driven refetch races. */
    skipClientRank?: boolean;
    viewerLat?: number | null;
    viewerLng?: number | null;
    priceFilter?: DiscoverPriceFilter | null;
  }
) {
  let viewerUserId: string | null;
  if (opts && 'viewerUserId' in opts) {
    viewerUserId = opts.viewerUserId ?? null;
  } else {
    const {
      data: { user },
    } = await client.auth.getUser();
    viewerUserId = user?.id ?? null;
  }

  const { data, error } = await discoverPlansQuery(
    client,
    viewerUserId,
    { from, to },
    opts?.priceFilter
  );

  if (error) return { data: [] as PlanFeedRow[], error };

  let plans = (data ?? []) as (DbPlan & { meet_types?: DbMeetType | null })[];
  if (viewerUserId) {
    const matched = await fetchViewerMatchedStandardPlans(client, viewerUserId, opts?.priceFilter);
    plans = mergeDiscoverPlans(plans, matched);
  }
  const profiles = await fetchProfilesForCreators(
    client,
    plans.map((p) => p.creator_id)
  );
  const rows = attachCreators(plans, profiles);
  if (opts?.skipClientRank) {
    return { data: rows, error: null };
  }
  return {
    data: rankDiscoveryPlans(rows, {
      effectiveLat: opts?.viewerLat ?? null,
      effectiveLng: opts?.viewerLng ?? null,
    }),
    error: null,
  };
}

export const DISCOVER_PAGE_SIZE = PAGE_SIZE;

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
