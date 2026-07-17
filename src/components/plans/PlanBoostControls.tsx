'use client';

import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { QuotaPipRow } from '@/components/subscription/QuotaPipRow';
import { TierBadge } from '@/components/subscription/TierBadge';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { activatePlanBoost, hasLegacyBoostCredit } from '@/lib/premium/boostPlan';
import { RADIUS_VISIBILITY_KM } from '@/lib/plans/planVisibilityConfig';
import { createClient } from '@/lib/supabase/client';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import {
  boost24Label,
  boost72Label,
  isBoost24Exhausted,
  isBoost72Exhausted,
  type BoostQuotaMeta,
} from '@/lib/subscription/boostQuota';
import { clearPermissionCache } from '@/hooks/usePermission';
import type { DbPlan, DbUser } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IoFlash, IoLockClosed, IoRocketOutline } from 'react-icons/io5';

type FeedbackState = {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
};

type Props = {
  planId: string;
  creatorId: string;
  dbUser: DbUser | null | undefined;
  boosted: boolean;
  boostedUntil: string | null | undefined;
  moodClosed: boolean;
  canBoost24: boolean;
  canBoost72: boolean;
  boost24Meta?: BoostQuotaMeta;
  boost72Meta?: BoostQuotaMeta;
  planVisibility?: DbPlan['visibility'];
  boostRadiusKm?: number | null;
  onBoosted: () => void;
  onRefreshPermissions?: () => void;
};

function formatBoostExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function PlanBoostControls({
  planId,
  creatorId,
  dbUser,
  boosted,
  boostedUntil,
  moodClosed,
  canBoost24,
  canBoost72,
  boost24Meta,
  boost72Meta,
  planVisibility,
  boostRadiusKm,
  onBoosted,
  onRefreshPermissions,
}: Props) {
  const queryClient = useQueryClient();
  const runGated = useGatedAction();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });

  const boost24Exhausted = isBoost24Exhausted(boost24Meta);
  const boost72Exhausted = isBoost72Exhausted(boost72Meta);
  const legacyCredit = hasLegacyBoostCredit(dbUser);
  const canUse24 = canBoost24 || legacyCredit;
  const boost24Monthly = boost24Meta?.boosts_24hr_monthly;
  const boost72Monthly = boost72Meta?.boosts_72hr_monthly;
  const boost24Unlimited = boost24Monthly === -1;
  const boost72Unlimited = boost72Monthly === -1;
  const creatorTier = resolveClientEffectiveTier(dbUser);
  const showGoldPremiumBoostNote =
    creatorTier === 'GOLD' && planVisibility === 'premium' && !boosted;
  const boostRadiusLabel = boostRadiusKm ?? RADIUS_VISIBILITY_KM;

  const disabled24 =
    moodClosed || busy || boosted || !canUse24 || (canBoost24 && boost24Exhausted);
  const disabled72 = moodClosed || busy || boosted || !canBoost72 || boost72Exhausted;

  function showActiveBoostNotice() {
    if (!boosted || !boostedUntil) return;
    setFeedback({
      open: true,
      title: 'Active boost',
      message: `This plan is already boosted in Discover until ${formatBoostExpiry(boostedUntil)}.`,
      variant: 'success',
    });
  }

  async function runBoost(hours: 24 | 72) {
    if (!dbUser?.id || moodClosed || busy) return;
    if (boosted) {
      showActiveBoostNotice();
      return;
    }

    setBusy(true);
    const client = createClient();
    const useCredit = hours === 24 && !canBoost24 && legacyCredit;
    const { error } = await activatePlanBoost(client, {
      planId,
      creatorId,
      hours,
      useLegacyCredit: useCredit,
      boostedUntil,
    });
    setBusy(false);

    if (error) {
      setFeedback({
        open: true,
        title: hours === 72 ? '72h boost' : 'Boost plan',
        message: error,
        variant: 'error',
      });
      return;
    }

    clearPermissionCache();
    onRefreshPermissions?.();
    void queryClient.invalidateQueries({ queryKey: ['discover'] });
    void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });

    setFeedback({
      open: true,
      title: 'Plan boosted',
      message: `Your plan is now boosted in Discover for ${hours} hours.`,
      variant: 'success',
    });
    onBoosted();
  }

  const secondary =
    'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-white px-4 py-2.5 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <>
      <AppStatusDialog
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        variant={feedback.variant}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
      />

      {boosted && boostedUntil ? (
        <button
          type="button"
          onClick={showActiveBoostNotice}
          className="col-span-full flex w-full items-center gap-2 rounded-2xl border border-primary/20 bg-gradient-to-r from-[#EDE8FF]/80 to-[#FFF0F5]/60 px-4 py-3 text-left transition hover:opacity-95"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full linkup-gradient-primary text-white">
            <IoFlash size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-foreground">Active boost</span>
            <span className="block text-[12px] font-semibold text-muted">
              Featured in Discover until {formatBoostExpiry(boostedUntil)}
            </span>
          </span>
        </button>
      ) : null}

      {showGoldPremiumBoostNote ? (
        <p className="col-span-full text-[12px] font-semibold text-muted">
          While boosted, Platinum members within {boostRadiusLabel}km will also be able to discover
          this plan.
        </p>
      ) : null}

      {canUse24 ? (
          <button
            type="button"
            className={secondary}
            disabled={disabled24}
            onClick={() => {
              if (boosted) {
                showActiveBoostNotice();
                return;
              }
              void runBoost(24);
            }}
          >
            <IoRocketOutline size={18} />
            {busy ? 'Boosting…' : boost24Label(boost24Meta, canBoost24)}
          </button>
        ) : (
          <button
            type="button"
            className={cn(secondary, 'opacity-60')}
            onClick={() => void runGated('boost.24hr', () => {})}
          >
            <IoLockClosed size={16} />
            Boost plan
            <TierBadge tier="SILVER" size="sm" />
          </button>
        )}

        {canBoost72 ? (
          <button
            type="button"
            className={cn(secondary, 'text-[13px]')}
            disabled={disabled72}
            onClick={() => {
              if (boosted) {
                showActiveBoostNotice();
                return;
              }
              void runBoost(72);
            }}
          >
            {busy ? 'Boosting…' : boost72Label(boost72Meta, canBoost72)}
          </button>
        ) : (
          <button
            type="button"
            className={cn(secondary, 'text-[13px] opacity-60')}
            onClick={() => void runGated('boost.72hr', () => {})}
          >
            <IoLockClosed size={14} />
            Boost 72h
            <TierBadge tier="GOLD" size="sm" />
          </button>
        )}

      {canBoost24 && boost24Monthly != null && boost24Monthly !== 0 ? (
        <QuotaPipRow
          className="col-span-full"
          total={boost24Unlimited ? 0 : boost24Monthly}
          used={boost24Meta?.boosts_24hr_used ?? 0}
          unlimited={boost24Unlimited}
          unlimitedLabel="Unlimited boosts"
        />
      ) : null}

      {canBoost72 && boost72Monthly != null && boost72Monthly !== 0 && !boost24Unlimited ? (
        <QuotaPipRow
          className="col-span-full"
          total={boost72Unlimited ? 0 : boost72Monthly}
          used={boost72Meta?.boosts_72hr_used ?? 0}
          unlimited={boost72Unlimited}
          unlimitedLabel="Unlimited 72h boosts"
        />
      ) : null}
    </>
  );
}
