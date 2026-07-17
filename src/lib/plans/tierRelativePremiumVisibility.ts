import { distanceKm } from '@/lib/location/distance';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import { RADIUS_VISIBILITY_KM } from '@/lib/plans/planVisibilityConfig';
import { tierRank } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { PlanFeedRow } from '@/services/plans.service';

export const DEFAULT_BOOST_RADIUS_KM = RADIUS_VISIBILITY_KM;

/** Creator tier from discover feed join (`users.subscription_tier`). */
export function resolveCreatorEffectiveTierFromFeedRow(row: PlanFeedRow): SubscriptionTier {
  const tier = row.creator?.subscription_tier;
  if (tier === 'PLATINUM' || tier === 'GOLD' || tier === 'SILVER') return tier;
  return 'FREE';
}

/**
 * Inclusive tier-relative audience for visibility='premium'.
 * Mirrors `auth_uid_can_see_plan` / `plan_premium_visibility_allows_viewer` in RLS.
 */
export function planPassesTierRelativePremiumVisibility(
  plan: PlanFeedRow,
  viewerUserId: string | null | undefined,
  viewerEffectiveTier: SubscriptionTier,
  viewerLat: number | null,
  viewerLng: number | null
): boolean {
  if (plan.visibility !== 'premium') return true;
  if (viewerUserId && plan.creator_id === viewerUserId) return true;

  const creatorRank = tierRank(resolveCreatorEffectiveTierFromFeedRow(plan));
  const viewerRank = tierRank(viewerEffectiveTier);
  const isBoosted = !!plan.boosted_until && new Date(plan.boosted_until) > new Date();
  const boostRadiusKm = plan.boost_radius_km ?? DEFAULT_BOOST_RADIUS_KM;

  if (creatorRank === 0) return viewerRank >= 1;
  if (creatorRank === 1) return viewerRank <= 1;
  if (creatorRank === 2) {
    if (viewerRank <= 2) return true;
    const meetup = planMeetupCoords(plan);
    if (
      isBoosted &&
      viewerRank === 3 &&
      viewerLat != null &&
      viewerLng != null &&
      meetup
    ) {
      return distanceKm(viewerLat, viewerLng, meetup.lat, meetup.lng) <= boostRadiusKm;
    }
    return false;
  }
  return true;
}

export function filterTierRelativePremiumVisibilityPlans(
  rows: PlanFeedRow[],
  viewerUserId: string | null | undefined,
  viewerEffectiveTier: SubscriptionTier,
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  return rows.filter((row) =>
    planPassesTierRelativePremiumVisibility(
      row,
      viewerUserId,
      viewerEffectiveTier,
      viewerLat,
      viewerLng
    )
  );
}

/** Free creators must upgrade; Silver+ can select visibility='premium'. */
export function canCreatorSelectPremiumVisibility(creatorTier: SubscriptionTier): boolean {
  return creatorTier !== 'FREE';
}

export function getFourthVisibilityOptionCopy(creatorTier: SubscriptionTier): {
  label: string;
  description: string;
  tierBadge?: SubscriptionTier;
} {
  switch (creatorTier) {
    case 'FREE':
      return {
        label: 'Silver, Gold & Platinum members',
        description:
          'Only members on a paid plan can discover this — a great way to get noticed by active members.',
        tierBadge: 'PLATINUM',
      };
    case 'SILVER':
      return {
        label: 'Free & Silver members only',
        description: 'Only Free and Silver members can discover this plan.',
      };
    case 'GOLD':
      return {
        label: 'Free, Silver & Gold members',
        description:
          'Free, Silver, and Gold members can discover this plan. If you boost it, nearby Platinum members can too.',
      };
    case 'PLATINUM':
      return {
        label: 'All members',
        description:
          'Everyone can discover this plan. Boosting puts it higher in feeds and extends its reach across cities.',
      };
  }
}
