import type { DbUser } from '@/types/database';
import type { BillingCycle, SubscriptionState, SubscriptionTier } from '@/lib/subscription/types';
import {
  hasActiveGoldTrial,
  hasActiveSilverTrial,
  resolveClientEffectiveTier,
  trialDaysRemaining,
} from '@/lib/subscription/effectiveTier';

export function deriveSubscriptionState(user: DbUser | null | undefined): SubscriptionState {
  const now = new Date();
  const tier = (user?.subscription_tier as SubscriptionTier | undefined) ?? 'FREE';
  const effectiveTier = resolveClientEffectiveTier(user, now.getTime());
  const subExpiry = user?.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
  const isPaidActive = tier !== 'FREE' && subExpiry !== null && subExpiry > now;
  const isSilverTrialActive = hasActiveSilverTrial(user, now.getTime());
  const isGoldTrialActive = hasActiveGoldTrial(user, now.getTime());

  let trialType: 'silver' | 'gold' | null = null;
  let trialDaysRemainingValue: number | null = null;

  if (isGoldTrialActive && effectiveTier === 'GOLD') {
    trialType = 'gold';
    trialDaysRemainingValue = trialDaysRemaining(user?.gold_trial_expires_at);
  } else if (isSilverTrialActive && effectiveTier === 'SILVER') {
    trialType = 'silver';
    trialDaysRemainingValue = trialDaysRemaining(user?.silver_trial_expires_at);
  }

  return {
    tier,
    effectiveTier,
    billingCycle: (user?.billing_cycle as BillingCycle | null | undefined) ?? null,
    expiresAt: user?.subscription_expires_at ?? null,
    silverTrialExpiresAt: user?.silver_trial_expires_at ?? null,
    goldTrialExpiresAt: user?.gold_trial_expires_at ?? null,
    goldTrialActivatedAt: user?.gold_trial_activated_at ?? null,
    hasBeenSilverSubscriber: user?.has_been_silver_subscriber ?? false,
    isTrialActive: isSilverTrialActive || isGoldTrialActive,
    trialType,
    trialDaysRemaining: trialDaysRemainingValue,
    isPaidActive,
  };
}
