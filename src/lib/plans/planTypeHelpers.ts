import type { DbPlan, PlanStatus } from '@/types/database';

export function isGroupPlan(plan: Pick<DbPlan, 'is_group_plan'>): boolean {
  return !!plan.is_group_plan;
}

export function isStandardPlan(plan: Pick<DbPlan, 'is_group_plan'>): boolean {
  return !plan.is_group_plan;
}

export function isNegotiablePlan(plan: Pick<DbPlan, 'is_negotiable'>): boolean {
  return plan.is_negotiable !== false;
}

export function isNonNegotiablePlan(plan: Pick<DbPlan, 'is_negotiable'>): boolean {
  return plan.is_negotiable === false;
}

/** When status is negotiating but price is fixed, show "Fixed" instead of "Negotiating". */
export function resolvePlanStatusDisplayLabel(
  plan: Pick<DbPlan, 'is_negotiable'> | null | undefined,
  status: PlanStatus
): PlanStatus | 'fixed' {
  if (status === 'negotiating' && plan && isNonNegotiablePlan(plan)) {
    return 'fixed';
  }
  return status;
}
