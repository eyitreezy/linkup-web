import type { PlanDetailBundle } from '@/services/planDetail.service';

/**
 * Action buttons need plan + offers array (may be empty). SSR initialBundle satisfies this on first paint.
 * Do not gate on isFetched — that stays false until the client refetch finishes and causes a long skeleton flash.
 */
export function isPlanDetailActionReady(bundle: PlanDetailBundle | undefined | null): boolean {
  return Boolean(bundle?.plan && Array.isArray(bundle.offers));
}

export function isPlanDetailOffersReady(bundle: PlanDetailBundle | undefined | null): boolean {
  return isPlanDetailActionReady(bundle);
}
