import type { SubscriptionTier } from '@/lib/subscription/types';

/** Tier-gated ceiling for the discover max-distance filter slider. */
export const SLIDER_MAX_KM: Record<SubscriptionTier, number> = {
  FREE: 50,
  SILVER: 50,
  GOLD: 100,
  PLATINUM: 150,
};

export function sliderMaxKmForTier(tier: SubscriptionTier): number {
  return SLIDER_MAX_KM[tier] ?? 50;
}

/** Upsell target for `discover.wider_radius` — FREE/SILVER → GOLD, GOLD → PLATINUM. */
export function nextTierForWiderRadius(tier: SubscriptionTier): SubscriptionTier {
  if (tier === 'GOLD') return 'PLATINUM';
  return 'GOLD';
}

export function clampMaxDistanceKm(value: number | null | undefined, tier: SubscriptionTier): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const max = sliderMaxKmForTier(tier);
  return Math.min(Math.max(1, Math.round(value)), max);
}
