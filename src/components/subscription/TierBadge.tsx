'use client';

import { TIER_META } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { cn } from '@/utils/cn';

type Props = {
  tier: SubscriptionTier;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-[11px]',
  lg: 'px-3 py-1.5 text-[12px]',
};

export function TierBadge({ tier, size = 'sm', className }: Props) {
  if (tier === 'FREE') return null;

  const meta = TIER_META[tier];
  const shortLabel = tier === 'SILVER' ? 'Silver' : tier === 'GOLD' ? 'Gold' : 'Platinum';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-extrabold uppercase tracking-wide',
        meta.badgeColor,
        meta.color,
        tier === 'GOLD' && 'animate-[tier-shimmer_2.5s_ease-in-out_infinite]',
        tier === 'PLATINUM' && 'ring-1 ring-violet-300/60',
        SIZE[size],
        className
      )}
    >
      {shortLabel}
    </span>
  );
}
