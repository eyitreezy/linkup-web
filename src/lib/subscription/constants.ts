import type { SubscriptionTier, TierMeta } from '@/lib/subscription/types';

export const TIER_META: Record<SubscriptionTier, TierMeta> = {
  FREE: {
    label: 'Free',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeColor: 'bg-gray-100',
    price: null,
  },
  SILVER: {
    label: 'Silver Explorer',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    badgeColor: 'bg-slate-200',
    price: {
      monthly: 1000,
      annual: 10000,
      annualSaving: 'Save 2 months',
    },
  },
  GOLD: {
    label: 'Gold Explorer',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    badgeColor: 'bg-amber-100',
    price: {
      monthly: 1500,
      annual: 15000,
      annualSaving: 'Save 3 months',
    },
    isPopular: true,
  },
  PLATINUM: {
    label: 'Platinum Explorer',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-400',
    badgeColor: 'bg-violet-100',
    price: {
      monthly: 3000,
      annual: 30000,
      annualSaving: 'Save 6 months',
    },
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  'group_plan.host': 'Group Plan Hosting',
  'mood_plan.extend': 'Mood Plan Extension',
  'discover.travel_mode': 'Travel Mode',
  'discover.undo_swipe': 'Undo Last Swipe',
  'discover.advanced_filters': 'Advanced Filters',
  'plans.bookmark': 'Save & Bookmark Plans',
  'plans.see_all_likes': 'See All Interested Users',
  'messaging.read_receipts': 'Read Receipts',
  'boost.24hr': 'Plan Boost',
  'boost.72hr': '72hr Plan Boost',
  'spotlight.profile': 'Profile Spotlight',
  'escrow.pattern_b': 'Mutual Contribution Escrow',
  'escrow.pattern_c': 'Companionship Arrangements',
  'escrow.high_value': 'High-Value Escrow',
  'discover.wider_radius': 'Wider Discover Reach',
  'privacy.incognito_browse': 'Incognito Browsing',
  'privacy.profile_view': 'Profile View Privacy',
  'privacy.masked_activity': 'Masked Activity',
  'privacy.plan_creation': 'Plan Creation Privacy',
  'concierge.support': 'Platinum Concierge Support',
};

export const TIER_ORDER: SubscriptionTier[] = ['FREE', 'SILVER', 'GOLD', 'PLATINUM'];

export const TIER_UPGRADE_BULLETS: Record<Exclude<SubscriptionTier, 'FREE'>, string[]> = {
  SILVER: ['Advanced filters', 'Bookmark plans', 'Read receipts', 'Plan Boosts'],
  GOLD: ['Group Plan hosting', 'Travel Mode', 'See all likes', 'Undo swipe'],
  PLATINUM: ['Incognito browsing', 'Unlimited boosts', 'Concierge support', 'Multi-city plans'],
};

export const TIER_CARD_FEATURES: Record<SubscriptionTier, string[]> = {
  FREE: [
    'Mutual Plans',
    'Mood Plans (24hr window)',
    'Escrow Pattern A',
    'Standard discovery filters',
    'In-app encrypted messaging',
  ],
  SILVER: [
    'Everything in Free',
    'Advanced filters',
    'Save & bookmark plans',
    'Read receipts in chat',
    '4 Plan Boosts per month',
    'Extended plan listing (14 days)',
  ],
  GOLD: [
    'Everything in Silver',
    'Host Group Plans',
    'Travel Mode',
    'See all interested users',
    '8 Plan Boosts per month',
    'Extended plan listing (14 days)',
  ],
  PLATINUM: [
    'Everything in Gold',
    'Incognito browsing',
    'Unlimited Boosts & Spotlights',
    'Longest plan listing (30 days)',
    'Masked activity — invisible in feeds',
    'Multi-city Group Plans',
    'Platinum concierge (2hr response)',
  ],
};

export function isTierAboveOrEqual(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

export function tierRank(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function formatNgn(amount: number): string {
  return `NGN ${amount.toLocaleString('en-NG')}`;
}
