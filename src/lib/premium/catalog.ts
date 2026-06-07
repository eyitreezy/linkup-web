/** Premium tiers — prices in Paystack minor units (kobo for NGN). Mirrors mobile. */

export type PremiumTierId = 'weekly' | 'monthly' | 'quarterly';

export type PremiumTier = {
  id: PremiumTierId;
  title: string;
  subtitle: string;
  durationDays: number;
  priceKobo: number;
  currency: string;
  bonusBoostCredits: number;
  recommended?: boolean;
};

export const PREMIUM_TIERS: PremiumTier[] = [
  {
    id: 'weekly',
    title: '7 days',
    subtitle: 'Try Premium',
    durationDays: 7,
    priceKobo: 150_000,
    currency: 'NGN',
    bonusBoostCredits: 1,
  },
  {
    id: 'monthly',
    title: '1 month',
    subtitle: 'Best value for regular hosts',
    durationDays: 30,
    priceKobo: 399_000,
    currency: 'NGN',
    bonusBoostCredits: 4,
    recommended: true,
  },
  {
    id: 'quarterly',
    title: '3 months',
    subtitle: 'Lowest weekly cost',
    durationDays: 90,
    priceKobo: 999_000,
    currency: 'NGN',
    bonusBoostCredits: 12,
  },
];

export function getTier(id: string | undefined | null): PremiumTier | null {
  return PREMIUM_TIERS.find((t) => t.id === id) ?? null;
}

export function formatTierPrice(tier: PremiumTier): string {
  return `${tier.currency} ${(tier.priceKobo / 100).toLocaleString()}`;
}
