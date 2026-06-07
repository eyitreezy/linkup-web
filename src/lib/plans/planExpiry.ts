import type { DbPlan } from '@/types/database';

type PlanLike = Pick<DbPlan, 'is_mood_plan' | 'is_expired' | 'mood_expires_at'>;

export function isPlanMoodWindowClosed(plan: PlanLike, nowMs: number = Date.now()): boolean {
  if (!plan.is_mood_plan) return false;
  if (plan.is_expired) return true;
  if (plan.mood_expires_at) return new Date(plan.mood_expires_at).getTime() <= nowMs;
  return false;
}
