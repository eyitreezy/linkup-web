/** Canonical permission for Premium Insights (view/save engagement list). */
export const PREMIUM_INSIGHTS_PERMISSION = 'plans.see_all_likes' as const;

export function planInterestPagePath(planId: string): string {
  return `/plan/${planId}/interest`;
}
