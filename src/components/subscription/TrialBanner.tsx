'use client';

import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { TIER_META } from '@/lib/subscription/constants';
import Link from 'next/link';
import { useState } from 'react';
import { IoClose, IoSparkles } from 'react-icons/io5';

export function TrialBanner() {
  const { subscriptionState } = useSubscriptionContext();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !subscriptionState.isTrialActive || subscriptionState.isPaidActive) {
    return null;
  }

  const isGold = subscriptionState.trialType === 'gold';
  const days = subscriptionState.trialDaysRemaining ?? 0;
  const tierLabel = isGold ? TIER_META.GOLD.label : TIER_META.SILVER.label;

  return (
    <div
      className={
        isGold
          ? 'border-b border-amber-200/80 bg-amber-50/95'
          : 'border-b border-primary/15 bg-[#EDE8FF]/90'
      }
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 min-[400px]:px-6">
        <Link
          href="/subscription"
          className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-semibold text-foreground min-[400px]:text-[13px]"
        >
          <IoSparkles className={isGold ? 'shrink-0 text-amber-600' : 'shrink-0 text-primary'} size={14} />
          <span className="truncate">
            {tierLabel} trial — {days} day{days === 1 ? '' : 's'} remaining
          </span>
          <span className="shrink-0 font-extrabold text-primary">Upgrade →</span>
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1 text-muted transition hover:bg-black/5"
          aria-label="Dismiss trial banner"
        >
          <IoClose size={16} />
        </button>
      </div>
    </div>
  );
}
