import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbMeetType, DbPlan } from '@/types/database';

export type PlanSharePreviewRow = Pick<
  DbPlan,
  | 'id'
  | 'title'
  | 'scheduled_at'
  | 'location_label'
  | 'current_suggested_share_cents'
  | 'total_amount_cents'
  | 'starting_price_cents'
  | 'accepted_guest_count'
  | 'max_guests'
  | 'is_group_plan'
  | 'creator_id'
> & {
  meet_types?: Pick<DbMeetType, 'name' | 'slug' | 'meet_type_images'> | null;
  creator?: { display_name: string | null; avatar_url: string | null } | null;
};

const PLAN_PREVIEW_FIELDS = `
  id,
  title,
  scheduled_at,
  location_label,
  current_suggested_share_cents,
  total_amount_cents,
  starting_price_cents,
  accepted_guest_count,
  max_guests,
  is_group_plan,
  creator_id,
  is_suppressed,
  meet_types ( name, slug, meet_type_images )
`;

export function planShareCity(locationLabel: string | null | undefined): string {
  return locationLabel?.split(',')[0]?.trim() || 'Nigeria';
}

export function planShareHostFirstName(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first || 'A LinkUp host';
}

export function planSharePriceLabel(
  plan: Pick<
    DbPlan,
    'current_suggested_share_cents' | 'total_amount_cents' | 'starting_price_cents'
  >
): string | null {
  if (plan.current_suggested_share_cents != null && plan.current_suggested_share_cents > 0) {
    return `From ${formatNGN(grossAmountCents(plan.current_suggested_share_cents))} / person`;
  }
  if (plan.total_amount_cents != null && plan.total_amount_cents > 0) {
    return formatNGN(grossAmountCents(plan.total_amount_cents));
  }
  if (plan.starting_price_cents != null && plan.starting_price_cents > 0) {
    return formatNGN(grossAmountCents(plan.starting_price_cents));
  }
  return null;
}

export function planSharePreviewUrl(planId: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, '')}/plan/${planId}/preview`;
}

export async function fetchPlanSharePreview(
  client: SupabaseClient,
  planId: string
): Promise<{ data: PlanSharePreviewRow | null; error: Error | null }> {
  const { data: plan, error: planError } = await client
    .from('plans')
    .select(PLAN_PREVIEW_FIELDS)
    .eq('id', planId)
    .eq('is_suppressed', false)
    .maybeSingle();

  if (planError) return { data: null, error: planError };
  if (!plan) return { data: null, error: null };

  const raw = plan as Record<string, unknown> & { creator_id: string };
  const meetRaw = raw.meet_types;
  const meet_types = Array.isArray(meetRaw)
    ? (meetRaw[0] as PlanSharePreviewRow['meet_types'])
    : (meetRaw as PlanSharePreviewRow['meet_types']);

  const row: Omit<PlanSharePreviewRow, 'creator'> = {
    id: raw.id as string,
    title: raw.title as string,
    scheduled_at: raw.scheduled_at as string | null,
    location_label: raw.location_label as string | null,
    current_suggested_share_cents: raw.current_suggested_share_cents as number | null,
    total_amount_cents: raw.total_amount_cents as number | null,
    starting_price_cents: raw.starting_price_cents as number | null,
    accepted_guest_count: raw.accepted_guest_count as number | undefined,
    max_guests: raw.max_guests as number | null,
    is_group_plan: raw.is_group_plan as boolean | undefined,
    creator_id: raw.creator_id,
    meet_types,
  };

  const { data: profile } = await client
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', row.creator_id)
    .maybeSingle();

  return {
    data: {
      ...row,
      creator: profile
        ? { display_name: profile.display_name as string | null, avatar_url: profile.avatar_url as string | null }
        : null,
    },
    error: null,
  };
}

export interface HostReviewPreview {
  id: string;
  reviewer_first_name: string;
  score_overall: number;
  review_text: string | null;
  meet_type_name: string | null;
  city: string | null;
  revealed_at: string;
}

export interface HostRatingPreview {
  host_rating_score: number | null;
  host_rating_count: number;
  completed_meetup_count: number;
  meets_public_threshold: boolean;
  recent_reviews: HostReviewPreview[];
}

type ReviewRowRaw = {
  id: string;
  reviewer_id: string;
  score_punctuality: number;
  score_conduct: number;
  score_plan_quality: number | null;
  review_text: string | null;
  revealed_at: string | null;
  plans?: {
    location_label: string | null;
    meet_types?: { name: string } | { name: string }[] | null;
  } | {
    location_label: string | null;
    meet_types?: { name: string } | { name: string }[] | null;
  }[] | null;
};

async function reviewerDisplayNames(
  client: SupabaseClient,
  reviewerIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (reviewerIds.length === 0) return map;

  const { data } = await client
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', reviewerIds);

  for (const row of data ?? []) {
    map.set(row.user_id as string, row.display_name as string | null);
  }
  return map;
}

export async function fetchHostRatingPreview(
  client: SupabaseClient,
  hostUserId: string
): Promise<{ data: HostRatingPreview | null; error: Error | null }> {
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('host_rating_score, host_rating_count, completed_meetup_count')
    .eq('user_id', hostUserId)
    .maybeSingle();

  if (profileError) return { data: null, error: profileError };
  if (!profile) return { data: null, error: null };

  const meetsThreshold = (profile.completed_meetup_count ?? 0) >= 3;

  const { data: reviews, error: reviewsError } = await client
    .from('meetup_reviews')
    .select(`
      id,
      reviewer_id,
      score_punctuality,
      score_conduct,
      score_plan_quality,
      review_text,
      revealed_at,
      plans!inner ( location_label, meet_types ( name ) )
    `)
    .eq('reviewee_id', hostUserId)
    .eq('reviewer_role', 'guest')
    .eq('is_hidden', false)
    .eq('is_suppressed', false)
    .gt('score_punctuality', 0)
    .order('revealed_at', { ascending: false })
    .limit(3);

  if (reviewsError) return { data: null, error: reviewsError };

  const reviewRows = (reviews ?? []) as ReviewRowRaw[];
  const namesByReviewer = await reviewerDisplayNames(
    client,
    [...new Set(reviewRows.map((r) => r.reviewer_id))]
  );

  const recentReviews: HostReviewPreview[] = reviewRows.map((r) => {
    const planQuality = r.score_plan_quality ?? r.score_conduct;
    const overall =
      planQuality * 0.4 + r.score_conduct * 0.35 + r.score_punctuality * 0.25;

    const plan = Array.isArray(r.plans) ? r.plans[0] : r.plans;
    const meetTypeRaw = plan?.meet_types;
    const meetType = Array.isArray(meetTypeRaw) ? meetTypeRaw[0] : meetTypeRaw;
    const displayName = namesByReviewer.get(r.reviewer_id);

    return {
      id: r.id,
      reviewer_first_name:
        displayName?.trim().split(/\s+/)[0] ?? 'A guest',
      score_overall: Math.round(overall * 10) / 10,
      review_text: r.review_text ?? null,
      meet_type_name: meetType?.name ?? null,
      city: planShareCity(plan?.location_label),
      revealed_at: r.revealed_at ?? '',
    };
  });

  return {
    data: {
      host_rating_score: profile.host_rating_score as number | null,
      host_rating_count: (profile.host_rating_count as number) ?? 0,
      completed_meetup_count: (profile.completed_meetup_count as number) ?? 0,
      meets_public_threshold: meetsThreshold,
      recent_reviews: recentReviews,
    },
    error: null,
  };
}
