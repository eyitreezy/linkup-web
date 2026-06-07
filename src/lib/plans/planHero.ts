import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import type { PlanFeedRow } from '@/services/plans.service';

/** Creator primary photo for plan heroes (Discover, plan detail). */
export function planHeroUri(plan: PlanFeedRow): string | null {
  return resolvePrimaryPhotoUrl(plan.creator ?? null);
}
