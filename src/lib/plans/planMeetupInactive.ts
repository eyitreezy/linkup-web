import type { DbPlan } from '@/types/database';
import { isPlanListingExpired } from '@/lib/plans/planExpiry';

export type PlanMeetupInactiveReason = 'cancelled' | 'completed' | 'listing_ended';

export type PlanMeetupInactive = {
  inactive: true;
  reason: PlanMeetupInactiveReason;
  title: string;
  message: string;
};

export type PlanMeetupInactiveFields = Pick<
  DbPlan,
  'status' | 'is_expired' | 'is_mood_plan' | 'mood_expires_at' | 'active_expires_at'
>;

export function resolvePlanMeetupInactive(
  plan: PlanMeetupInactiveFields,
  listingExpired?: boolean
): PlanMeetupInactive | { inactive: false } {
  const expired = listingExpired ?? isPlanListingExpired(plan);

  if (plan.status === 'cancelled') {
    return {
      inactive: true,
      reason: 'cancelled',
      title: 'Plan cancelled',
      message:
        'This meetup was cancelled. Confirm plan and payment actions are no longer available. Refunds, when applicable, follow the cancellation policy shown at cancel time.',
    };
  }

  if (plan.status === 'completed') {
    return {
      inactive: true,
      reason: 'completed',
      title: 'Meetup ended',
      message:
        'This meetup has ended. Confirm plan and payment actions are no longer available.',
    };
  }

  if (expired) {
    return {
      inactive: true,
      reason: 'listing_ended',
      title: 'Plan expired',
      message:
        'This plan listing has ended. Confirm plan and payment actions are no longer available.',
    };
  }

  return { inactive: false };
}
