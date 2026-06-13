import type { SubscriptionTier } from '@/lib/subscription/types';
import type { PlanFeedRow } from '@/services/plans.service';

/** Defence-in-depth when RLS does not filter premium visibility rows. */
export function filterPremiumVisibilityPlans(
  rows: PlanFeedRow[],
  viewerTier: SubscriptionTier
): PlanFeedRow[] {
  if (viewerTier === 'GOLD' || viewerTier === 'PLATINUM') return rows;
  return rows.filter((row) => row.visibility !== 'premium');
}
