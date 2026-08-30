/** Server-side subscription pricing — never trust client amounts. */

export const PRICING = {
  SILVER: {
    monthly: { amount_ngn: 1000 },
    annual: { amount_ngn: 10000 },
  },
  GOLD: {
    monthly: { amount_ngn: 1500 },
    annual: { amount_ngn: 15000 },
  },
  PLATINUM: {
    monthly: { amount_ngn: 3000 },
    annual: { amount_ngn: 30000 },
  },
} as const;

export type PaidTier = 'SILVER' | 'GOLD' | 'PLATINUM';
export type BillingCycle = 'monthly' | 'annual';

export function tierPriceNgn(tier: PaidTier, cycle: BillingCycle): number {
  return PRICING[tier][cycle].amount_ngn;
}

export function tierPriceCents(tier: PaidTier, cycle: BillingCycle): number {
  return tierPriceNgn(tier, cycle) * 100;
}
