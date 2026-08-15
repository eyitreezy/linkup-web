import type { DbPlan } from '@/types/database';

/** Fields used to determine whether a plan's discover/listing window has ended. */
export type PlanListingExpiryFields = Pick<
  DbPlan,
  'is_mood_plan' | 'is_expired' | 'mood_expires_at' | 'active_expires_at'
>;

type PlanLike = PlanListingExpiryFields;

/**
 * Single source of truth: a plan listing is expired when:
 * - `is_expired` is true (DB flag), OR
 * - mood plan: `mood_expires_at` has passed, OR
 * - standard/group listing: `active_expires_at` has passed (when set at publish).
 */
export function isPlanListingExpired(plan: PlanLike, nowMs: number = Date.now()): boolean {
  if (plan.is_expired) return true;

  if (plan.is_mood_plan) {
    if (!plan.mood_expires_at) return false;
    return new Date(plan.mood_expires_at).getTime() <= nowMs;
  }

  if (plan.active_expires_at) {
    return new Date(plan.active_expires_at).getTime() <= nowMs;
  }

  return false;
}

/** @deprecated Prefer {@link isPlanListingExpired}. Kept for call sites that only handled mood plans. */
export function isPlanMoodWindowClosed(plan: PlanLike, nowMs: number = Date.now()): boolean {
  if (!plan.is_mood_plan) return false;
  return isPlanListingExpired(plan, nowMs);
}

export function isPlanDiscoverable(plan: PlanLike, nowMs: number = Date.now()): boolean {
  return !isPlanListingExpired(plan, nowMs);
}

export function planListingExpiresAt(plan: PlanLike): Date | null {
  if (plan.is_mood_plan && plan.mood_expires_at) {
    return new Date(plan.mood_expires_at);
  }
  if (!plan.is_mood_plan && plan.active_expires_at) {
    return new Date(plan.active_expires_at);
  }
  return null;
}
