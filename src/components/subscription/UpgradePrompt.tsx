'use client';

import { FEATURE_LABELS, TIER_META, TIER_UPGRADE_BULLETS } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { cn } from '@/utils/cn';
import { IoCheckmarkCircle, IoSparkles } from 'react-icons/io5';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier;
  onUpgrade: () => void;
};

export function UpgradePrompt({
  isOpen,
  onClose,
  feature,
  requiredTier,
  onUpgrade,
}: Props) {
  if (!isOpen || requiredTier === 'FREE') return null;

  const featureLabel = FEATURE_LABELS[feature] ?? feature.replace(/\./g, ' ').replace(/_/g, ' ');
  const tierMeta = TIER_META[requiredTier];
  const bullets = TIER_UPGRADE_BULLETS[requiredTier];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-prompt-title"
      onClick={onClose}
    >
      <div
        className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-5 shadow-xl min-[425px]:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl linkup-gradient-primary shadow-md">
          <IoSparkles size={28} className="text-white" />
        </div>
        <h2 id="upgrade-prompt-title" className="mt-4 text-center font-display text-xl font-extrabold text-foreground">
          Unlock {featureLabel}
        </h2>
        <p className="mt-2 text-center text-[14px] font-semibold leading-relaxed text-muted">
          Available on {tierMeta.label} and above.
        </p>
        <ul className="mt-4 space-y-2">
          {bullets.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] font-semibold text-foreground">
              <IoCheckmarkCircle className="mt-0.5 shrink-0 text-primary" size={16} />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 min-[425px]:flex-row min-[425px]:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-full border border-border px-4 text-[14px] font-extrabold text-muted min-[425px]:w-auto"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            className={cn(
              'min-h-[44px] w-full rounded-full px-4 text-[14px] font-extrabold text-white shadow-sm min-[425px]:w-auto',
              requiredTier === 'PLATINUM'
                ? 'bg-violet-600 hover:bg-violet-700'
                : requiredTier === 'GOLD'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'linkup-gradient-primary'
            )}
          >
            Upgrade to {tierMeta.label.replace(' Explorer', '')}
          </button>
        </div>
      </div>
    </div>
  );
}
