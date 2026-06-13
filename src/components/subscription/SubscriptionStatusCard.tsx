'use client';

import { TierBadge } from '@/components/subscription/TierBadge';
import {
  TIER_META,
  TIER_UPGRADE_BULLETS,
  formatNgn,
} from '@/lib/subscription/constants';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoChevronForward, IoDiamondOutline, IoSparkles } from 'react-icons/io5';

type CardVariant = 'free' | 'trial' | 'paid';

type ShellProps = {
  href: string;
  variant: CardVariant;
  tier?: SubscriptionTier;
  trialTier?: 'silver' | 'gold';
  title: string;
  subtitle: string;
  cta: string;
  pills?: string[];
};

function FeaturePills({ labels }: { labels: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {labels.slice(0, 3).map((label) => (
        <li
          key={label}
          className="rounded-full border border-primary/12 bg-white/85 px-2.5 py-1 text-[11px] font-bold text-foreground/85 shadow-sm backdrop-blur-sm"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function SubscriptionStatusCardShell({
  href,
  variant,
  tier,
  trialTier,
  title,
  subtitle,
  cta,
  pills,
}: ShellProps) {
  const isFree = variant === 'free';
  const isTrial = variant === 'trial';
  const paidTier = tier && tier !== 'FREE' ? tier : null;

  const borderClass = isFree
    ? 'linkup-gradient-primary'
    : isTrial
      ? trialTier === 'gold'
        ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500'
        : 'bg-gradient-to-br from-slate-300 via-primary/50 to-secondary/40'
      : paidTier === 'GOLD'
        ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-400'
        : paidTier === 'PLATINUM'
          ? 'bg-gradient-to-br from-violet-400 via-primary to-secondary'
          : paidTier === 'SILVER'
            ? 'bg-gradient-to-br from-slate-300 via-slate-200 to-primary/35'
            : 'linkup-gradient-primary';

  const innerBg = isFree
    ? 'bg-gradient-to-br from-white via-[#F8F4FF] to-[#FFF5F8]'
    : isTrial
      ? trialTier === 'gold'
        ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50/80'
        : 'bg-gradient-to-br from-slate-50 via-white to-[#F8F4FF]'
      : paidTier
        ? cn(TIER_META[paidTier].bgColor, 'bg-gradient-to-br from-white/70 via-white/40 to-transparent')
        : 'bg-white';

  const iconShellClass =
    isFree || isTrial || paidTier === 'SILVER' || paidTier === 'PLATINUM'
      ? 'linkup-gradient-primary'
      : 'bg-gradient-to-br from-amber-500 to-orange-500';

  const ctaClass =
    isFree || isTrial || paidTier === 'SILVER' || paidTier === 'PLATINUM'
      ? 'linkup-gradient-primary'
      : 'bg-gradient-to-r from-amber-500 to-orange-500';

  return (
    <Link
      href={href}
      className={cn(
        'group block touch-manipulation overflow-hidden rounded-[22px] p-[2px] shadow-[0_10px_32px_rgba(108,99,255,0.16)] transition hover:shadow-[0_14px_40px_rgba(108,99,255,0.22)] active:scale-[0.99]',
        borderClass
      )}
    >
      <div className={cn('relative overflow-hidden rounded-[20px] p-4 min-[400px]:p-5', innerBg)}>
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-6 left-1/4 h-20 w-20 rounded-full bg-secondary/10"
          aria-hidden
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md min-[400px]:h-[52px] min-[400px]:w-[52px]',
                iconShellClass
              )}
            >
              {isTrial ? <IoSparkles size={24} aria-hidden /> : <IoDiamondOutline size={24} aria-hidden />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {isFree ? (
                  <span className="rounded-full bg-[#EDE8FF] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                    Current plan
                  </span>
                ) : isTrial ? (
                  <>
                    <TierBadge tier={trialTier === 'gold' ? 'GOLD' : 'SILVER'} size="md" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Trial</span>
                  </>
                ) : paidTier ? (
                  <TierBadge tier={paidTier} size="md" />
                ) : null}
              </div>
              <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground min-[400px]:text-xl">
                {title}
              </h3>
              <p className="mt-0.5 text-[13px] font-semibold leading-snug text-muted">{subtitle}</p>
            </div>
          </div>

          <span
            className={cn(
              'inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white shadow-md transition group-hover:opacity-95 sm:w-auto min-[400px]:min-h-[44px]',
              ctaClass
            )}
          >
            {cta}
            <IoChevronForward size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>

        {pills && pills.length > 0 ? (
          <div className="relative mt-3 border-t border-primary/8 pt-3">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-muted">
              {isFree ? 'Unlock with Silver+' : 'Your perks'}
            </p>
            <FeaturePills labels={pills} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function SubscriptionStatusCard() {
  const { subscriptionState } = useSubscriptionContext();
  const { tier, billingCycle, expiresAt, isTrialActive, trialDaysRemaining, isPaidActive, trialType } =
    subscriptionState;

  if (isTrialActive && !isPaidActive) {
    const trialMeta = trialType === 'gold' ? TIER_META.GOLD : TIER_META.SILVER;
    const trialTierKey = trialType === 'gold' ? 'GOLD' : 'SILVER';
    return (
      <SubscriptionStatusCardShell
        href="/subscription"
        variant="trial"
        trialTier={trialType ?? 'silver'}
        title={`${trialMeta.label} trial`}
        subtitle={`${trialDaysRemaining ?? 0} day${trialDaysRemaining === 1 ? '' : 's'} remaining · No charge until you upgrade`}
        cta="Upgrade now"
        pills={TIER_UPGRADE_BULLETS[trialTierKey].slice(0, 3)}
      />
    );
  }

  if (isPaidActive && tier !== 'FREE') {
    const meta = TIER_META[tier];
    const price =
      billingCycle === 'annual' && meta.price
        ? `${formatNgn(meta.price.annual)}/yr`
        : meta.price
          ? `${formatNgn(meta.price.monthly)}/month`
          : '';
    const renews = expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    return (
      <SubscriptionStatusCardShell
        href="/subscription"
        variant="paid"
        tier={tier}
        title={meta.label}
        subtitle={[price, renews ? `Renews ${renews}` : ''].filter(Boolean).join(' · ')}
        cta="Manage plan"
        pills={TIER_UPGRADE_BULLETS[tier].slice(0, 3)}
      />
    );
  }

  return (
    <SubscriptionStatusCardShell
      href="/subscription"
      variant="free"
      title="Free Explorer"
      subtitle="Upgrade to unlock bookmarks, advanced filters, plan boosts, and more."
      cta="See plans"
      pills={TIER_UPGRADE_BULLETS.SILVER.slice(0, 3)}
    />
  );
}
