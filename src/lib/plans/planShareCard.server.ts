import { fetchPlanSharePreview, type PlanSharePreviewRow } from '@/lib/plans/planSharePreview';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { DbPlan } from '@/types/database';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';

/** ASCII-safe price copy for OG/Satori (default fonts omit the naira glyph). */
export function planShareOgPriceLabel(
  plan: Pick<
    DbPlan,
    'current_suggested_share_cents' | 'total_amount_cents' | 'starting_price_cents'
  >
): string | null {
  const formatNgn = (cents: number) =>
    `NGN ${Math.round(cents / 100).toLocaleString('en-NG')}`;

  if (plan.current_suggested_share_cents != null && plan.current_suggested_share_cents > 0) {
    return `From ${formatNgn(grossAmountCents(plan.current_suggested_share_cents))} / person`;
  }
  if (plan.total_amount_cents != null && plan.total_amount_cents > 0) {
    return formatNgn(grossAmountCents(plan.total_amount_cents));
  }
  if (plan.starting_price_cents != null && plan.starting_price_cents > 0) {
    return formatNgn(grossAmountCents(plan.starting_price_cents));
  }
  return null;
}

/** Prefer the signed-in viewer's session so hosts can render cards for non-public plans. */
export async function loadPlanForShareCard(
  planId: string
): Promise<{ data: PlanSharePreviewRow | null; error: Error | null }> {
  if (isSupabaseConfigured) {
    try {
      const authed = await createClient();
      const authedResult = await fetchPlanSharePreview(authed, planId);
      if (authedResult.data) return authedResult;
      if (authedResult.error) return authedResult;
    } catch {
      /* fall back to public client */
    }
  }

  return fetchPlanSharePreview(createPublicClient(), planId);
}
