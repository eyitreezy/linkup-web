import type { PremiumTier } from '@/lib/premium/catalog';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Demo fulfillment after Paystack success (dev only).
 * Production entitlements must come from `paystack-webhook-premium`.
 */
export async function applyPremiumPurchase(
  client: SupabaseClient,
  userId: string,
  tier: PremiumTier
): Promise<{ error: string | null }> {
  const until = new Date();
  until.setDate(until.getDate() + tier.durationDays);

  const { data: row, error: readErr } = await client
    .from('users')
    .select('boost_credits')
    .eq('id', userId)
    .single();
  if (readErr) return { error: readErr.message };

  const current = typeof row?.boost_credits === 'number' ? row.boost_credits : 0;

  const { error } = await client
    .from('users')
    .update({
      premium_until: until.toISOString(),
      subscription_status: 'active',
      boost_credits: current + tier.bonusBoostCredits,
    })
    .eq('id', userId);

  return { error: error?.message ?? null };
}
