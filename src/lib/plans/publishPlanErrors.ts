import type { PaidTier } from '@/lib/subscription/types';

export type PublishUpgradeNudge = {
  tier: PaidTier;
  feature: string;
  message: string;
} | null;

export function parsePublishPlanError(message: string): {
  userMessage: string;
  nudge: PublishUpgradeNudge;
} {
  if (message.includes('escrow_pattern_b_requires_silver')) {
    return {
      userMessage: 'Split escrow requires a Silver subscription or above.',
      nudge: { tier: 'SILVER', feature: 'escrow.pattern_b', message: 'Split escrow requires Silver or above.' },
    };
  }
  if (message.includes('escrow_pattern_c_requires_gold')) {
    return {
      userMessage: 'Guest-funded escrow requires a Gold subscription or above.',
      nudge: { tier: 'GOLD', feature: 'escrow.pattern_c', message: 'Guest-funded escrow requires Gold or above.' },
    };
  }
  if (message.includes('High-value escrow requires Platinum') || message.includes('high_value')) {
    return {
      userMessage: 'Escrow above ₦5,000,000 requires a Platinum subscription.',
      nudge: {
        tier: 'PLATINUM',
        feature: 'escrow.high_value',
        message: 'High-value escrow requires Platinum.',
      },
    };
  }
  return { userMessage: message, nudge: null };
}
