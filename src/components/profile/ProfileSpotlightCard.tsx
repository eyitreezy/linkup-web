'use client';

import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { QuotaPipRow } from '@/components/subscription/QuotaPipRow';
import { TierBadge } from '@/components/subscription/TierBadge';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { usePermission } from '@/hooks/usePermission';
import { MONTHLY_SPOTLIGHTS } from '@/lib/subscription/boostQuota';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { cn } from '@/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoSparkles, IoStar } from 'react-icons/io5';

type Props = {
  userId: string;
  spotlightUntil: string | null | undefined;
};

function formatSpotlightExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ProfileSpotlightCard({ userId, spotlightUntil }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const runGated = useGatedAction();
  const {
    allowed: canSpotlight,
    loading: permLoading,
    metadata,
    effectiveTier,
    refresh: refreshPerm,
  } = usePermission('spotlight.profile', { checkQuota: true });

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'success' | 'error';
  }>({ open: false, title: '', message: '', variant: 'success' });

  const tier = effectiveTier as SubscriptionTier;
  const isUnlimited = tier === 'PLATINUM' || MONTHLY_SPOTLIGHTS[tier] === -1;
  const used = (metadata?.quota_used as number | undefined) ?? (metadata?.spotlights_used as number | undefined) ?? 0;
  const limit =
    (metadata?.quota_limit as number | undefined) ??
    (metadata?.spotlights_monthly as number | undefined) ??
    MONTHLY_SPOTLIGHTS[tier];
  const total = limit != null && limit > 0 ? limit : Math.max(0, MONTHLY_SPOTLIGHTS[tier]);
  const remaining = isUnlimited ? Infinity : Math.max(0, total - used);
  const isActive = !!(spotlightUntil && new Date(spotlightUntil).getTime() > Date.now());

  async function handleActivate() {
    if (!canSpotlight) {
      void runGated('spotlight.profile', () => router.push('/subscription'));
      return;
    }
    if (isActive || remaining === 0) return;

    setBusy(true);
    const client = createClient();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (!isUnlimited) {
      const { error: quotaErr } = await client.rpc('record_boost_usage', { p_kind: 'spotlights' });
      if (quotaErr) {
        setBusy(false);
        setFeedback({
          open: true,
          title: 'Profile spotlight',
          message: quotaErr.message,
          variant: 'error',
        });
        return;
      }
    }

    const { error } = await client
      .from('profiles')
      .update({ spotlight_until: expiresAt })
      .eq('user_id', userId);

    setBusy(false);

    if (error) {
      setFeedback({
        open: true,
        title: 'Profile spotlight',
        message: error.message,
        variant: 'error',
      });
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['profile-bundle', userId] });
    void refreshPerm();
    router.refresh();
    setFeedback({
      open: true,
      title: 'Spotlight active',
      message: 'Your profile is featured in Discover for 24 hours.',
      variant: 'success',
    });
  }

  const ctaDisabled = busy || permLoading || isActive || (canSpotlight && !isUnlimited && remaining === 0);

  return (
    <>
      <AppStatusDialog
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        variant={feedback.variant}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
      />

      <div className="overflow-hidden rounded-[22px] border border-amber-200/50 bg-gradient-to-br from-amber-50/90 via-white to-[#F8F4FF] p-4 shadow-[0_8px_24px_rgba(251,191,36,0.12)] min-[400px]:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-md">
              <IoStar size={22} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                Visibility
              </p>
              <h3 className="font-display text-lg font-extrabold text-foreground">Profile spotlight</h3>
              <p className="mt-0.5 text-[12px] font-semibold leading-snug text-muted min-[400px]:text-[13px]">
                {isActive
                  ? `Active until ${formatSpotlightExpiry(spotlightUntil!)}`
                  : 'Promote your profile for 24 hours in Discover'}
              </p>
            </div>
          </div>
          {isActive ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
              <IoSparkles size={10} aria-hidden />
              Active
            </span>
          ) : null}
        </div>

        {canSpotlight && !isUnlimited && total > 0 ? (
          <QuotaPipRow total={total} used={used} className="mt-3" />
        ) : null}

        {canSpotlight && isUnlimited ? (
          <p className="mt-3 text-center text-[11px] font-semibold text-muted">Unlimited spotlights</p>
        ) : null}

        <div className="mt-4">
          {canSpotlight ? (
            <button
              type="button"
              disabled={ctaDisabled}
              onClick={() => void handleActivate()}
              className={cn(
                'flex w-full min-h-[44px] items-center justify-center rounded-full px-4 py-2.5 text-[14px] font-extrabold transition',
                ctaDisabled
                  ? 'cursor-not-allowed bg-[#E8E4F5] text-muted'
                  : 'linkup-gradient-primary text-white shadow-sm hover:opacity-95'
              )}
            >
              {busy
                ? 'Activating…'
                : isActive
                  ? 'Spotlight active'
                  : remaining === 0
                    ? 'Monthly limit reached'
                    : 'Spotlight my profile'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void runGated('spotlight.profile', () => router.push('/subscription'))}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2.5 text-[14px] font-extrabold text-foreground transition hover:bg-[#EDE8FF]/40"
            >
              Available on Silver and above
              <TierBadge tier="SILVER" size="sm" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
