'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { TIER_META } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { IoBookmarkOutline, IoSparkles } from 'react-icons/io5';

type Props = {
  requiredTier: SubscriptionTier;
};

export function SavedUpgradeEmptyState({ requiredTier }: Props) {
  const tierLabel = TIER_META[requiredTier].label;

  return (
    <AppEmptyState
      emoji="🔖"
      title="Save plans you love"
      titleAccent="Save"
      description={`Bookmark meetups from Discover with ${tierLabel} and above — your shortlist stays in sync with the mobile app.`}
      tips={[
        { icon: IoBookmarkOutline, text: 'One tap save from any plan detail screen' },
        {
          icon: IoSparkles,
          text: 'Upgrade unlocks bookmarks plus filters, boosts, and more',
          iconBgClassName: 'bg-amber-100',
          iconClassName: 'text-amber-600',
        },
      ]}
      action={{ label: `Upgrade to ${tierLabel.replace(' Explorer', '')}`, href: `/subscription?tier=${requiredTier}` }}
      secondaryAction={{ label: 'Browse Discover', href: '/discover', variant: 'secondary' }}
    />
  );
}
