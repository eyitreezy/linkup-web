import type { SupabaseClient } from '@supabase/supabase-js';
import { hasBoostCredit } from '@/lib/premium/access';
import { isPlanBoostActive } from '@/lib/plans/planBoost';

const BOOST_HOURS_24 = 24;
const BOOST_HOURS_72 = 72;

function mapBoostRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('boost_already_active')) {
    return 'This plan already has an active boost.';
  }
  if (lower.includes('plan_listing_expired') || lower.includes('plan_expired')) {
    return 'This plan listing has expired and cannot be boosted.';
  }
  if (lower.includes('mood_plan_closed')) {
    return 'This mood moment has ended. Boost is no longer available.';
  }
  if (lower.includes('not_plan_creator')) {
    return 'Only the plan creator can boost this plan.';
  }
  if (lower.includes('not_authenticated')) {
    return 'Please sign in to boost this plan.';
  }
  return message;
}

export async function activatePlanBoost(
  client: SupabaseClient,
  args: {
    planId: string;
    creatorId: string;
    hours?: 24 | 72;
    useLegacyCredit?: boolean;
    boostedUntil?: string | null;
  }
): Promise<{ error: string | null }> {
  if (isPlanBoostActive(args.boostedUntil)) {
    const until = new Date(args.boostedUntil!).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return { error: `This plan already has an active boost until ${until}.` };
  }

  const hours = args.hours ?? BOOST_HOURS_24;

  if (args.useLegacyCredit) {
    const { data: uRow } = await client
      .from('users')
      .select('boost_credits')
      .eq('id', args.creatorId)
      .maybeSingle();
    const credits = (uRow?.boost_credits as number) ?? 0;
    if (credits <= 0) return { error: 'No boost credits available.' };
    const { error: e1 } = await client
      .from('users')
      .update({ boost_credits: credits - 1 })
      .eq('id', args.creatorId)
      .eq('boost_credits', credits);
    if (e1) return { error: e1.message };

    const until = new Date();
    until.setHours(until.getHours() + hours);
    const { error: e2 } = await client
      .from('plans')
      .update({ boosted_until: until.toISOString(), spotlight_enabled: true })
      .eq('id', args.planId)
      .eq('creator_id', args.creatorId);
    return { error: e2?.message ?? null };
  }

  const { data, error } = await client.rpc('activate_plan_boost', {
    p_plan_id: args.planId,
    p_hours: hours,
  });

  if (error) {
    return { error: mapBoostRpcError(error.message) };
  }

  const row = data as { ok?: boolean; boostedUntil?: string } | null;
  if (!row?.ok) {
    return { error: 'Could not activate boost. Please try again.' };
  }

  return { error: null };
}

export function hasLegacyBoostCredit(
  u: { boost_credits?: number | null } | null | undefined
): boolean {
  return hasBoostCredit(u as { boost_credits: number } | null | undefined);
}
