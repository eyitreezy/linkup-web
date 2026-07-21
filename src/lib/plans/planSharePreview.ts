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
