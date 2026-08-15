export type DiscoverPlanTypePill = {
  label: string;
  colorClass: string;
};

type PlanKindSource = {
  is_group_plan?: boolean | null;
  is_mood_plan?: boolean | null;
};

/** Shared plan-type pill config for Discover grid and list views. */
export function discoverPlanTypePill(plan: PlanKindSource): DiscoverPlanTypePill | null {
  if (plan.is_group_plan) {
    return { label: 'Group', colorClass: 'bg-[#5E52FF]/80 text-white' };
  }
  if (plan.is_mood_plan) {
    return { label: 'Mood', colorClass: 'bg-[#FF4A72]/80 text-white' };
  }
  return null;
}
