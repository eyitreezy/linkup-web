export const PLAN_DETAIL_FROM = {
  discover: 'discover',
  planManagement: 'plan-management',
} as const;

export type PlanDetailFrom = (typeof PLAN_DETAIL_FROM)[keyof typeof PLAN_DETAIL_FROM];

export function planDetailHref(planId: string, from?: PlanDetailFrom): string {
  if (!from) return `/plan/${planId}`;
  return `/plan/${planId}?from=${encodeURIComponent(from)}`;
}

export function parsePlanDetailFrom(raw: string | null | undefined): PlanDetailFrom | null {
  if (raw === PLAN_DETAIL_FROM.discover) return PLAN_DETAIL_FROM.discover;
  if (raw === PLAN_DETAIL_FROM.planManagement) return PLAN_DETAIL_FROM.planManagement;
  return null;
}

export function resolvePlanDetailBack(from: PlanDetailFrom | null): { href: string; label: string } {
  if (from === PLAN_DETAIL_FROM.discover) {
    return { href: '/discover', label: 'Back to Discover' };
  }
  return { href: '/plan-management', label: 'Back to Plan management' };
}
