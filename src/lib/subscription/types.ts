export type SubscriptionTier = 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type BillingCycle = 'monthly' | 'annual';
export type PaidTier = 'SILVER' | 'GOLD' | 'PLATINUM';

export interface TierMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  price: {
    monthly: number;
    annual: number;
    annualSaving: string;
  } | null;
  isPopular?: boolean;
}

export interface PermissionResult {
  allowed: boolean;
  effectiveTier: SubscriptionTier;
  reason?: string;
  upgradeTo?: SubscriptionTier;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  effectiveTier: SubscriptionTier;
  billingCycle: BillingCycle | null;
  expiresAt: string | null;
  silverTrialExpiresAt: string | null;
  goldTrialExpiresAt: string | null;
  goldTrialActivatedAt: string | null;
  hasBeenSilverSubscriber: boolean;
  isTrialActive: boolean;
  trialType: 'silver' | 'gold' | null;
  trialDaysRemaining: number | null;
  isPaidActive: boolean;
}
