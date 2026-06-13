'use client';

import { TierBadge } from '@/components/subscription/TierBadge';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import {
  formatNgn,
  TIER_CARD_FEATURES,
  TIER_META,
  TIER_ORDER,
  tierRank,
} from '@/lib/subscription/constants';
import { hasLegacyPremium } from '@/lib/subscription/effectiveTier';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { BillingCycle, PaidTier, SubscriptionTier } from '@/lib/subscription/types';
import { useSubscriptionActions } from '@/hooks/useSubscription';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoCheckmarkCircle, IoChevronForward, IoDiamondOutline, IoSparkles } from 'react-icons/io5';

export function SubscriptionScreen() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get('tier') as SubscriptionTier | null;
  const { subscriptionState, refreshSubscription, dbUser } = useSubscriptionContext();
  const {
    initiateSubscription,
    cancelSubscription,
    activateGoldTrial,
    checkoutBusy,
    cancelBusy,
    trialBusy,
  } = useSubscriptionActions();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const checkoutTierRef = useRef<PaidTier | null>(null);
  const tierBeforeCheckout = useRef(subscriptionState.effectiveTier);

  const effective = subscriptionState.effectiveTier;
  const paidTier = subscriptionState.tier;

  useEffect(() => {
    if (
      checkoutTierRef.current &&
      subscriptionState.effectiveTier !== tierBeforeCheckout.current &&
      (subscriptionState.isPaidActive || tierRank(subscriptionState.effectiveTier) > tierRank(tierBeforeCheckout.current))
    ) {
      const label = TIER_META[subscriptionState.effectiveTier].label;
      setStatusMsg(`You're now on ${label} 🎉`);
      checkoutTierRef.current = null;
      void refreshSubscription();
    }
  }, [subscriptionState.effectiveTier, subscriptionState.isPaidActive, refreshSubscription]);

  const showGoldTrial =
    subscriptionState.tier === 'SILVER' &&
    subscriptionState.isPaidActive &&
    !subscriptionState.goldTrialActivatedAt;

  const goldCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preselected === 'GOLD' && goldCardRef.current) {
      goldCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [preselected]);

  async function handleUpgrade(tier: PaidTier) {
    setErrorMsg(null);
    tierBeforeCheckout.current = subscriptionState.effectiveTier;
    checkoutTierRef.current = tier;
    const result = await initiateSubscription(tier, billingCycle);
    if (!result.ok) setErrorMsg(result.error ?? 'Checkout failed');
  }

  async function handleCancel() {
    const result = await cancelSubscription();
    if (result.ok) {
      setCancelOpen(false);
      setStatusMsg(
        result.accessUntil
          ? `Subscription cancelled — access until ${new Date(result.accessUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : 'Subscription cancelled'
      );
    } else {
      setErrorMsg(result.error ?? 'Could not cancel');
    }
  }

  async function handleGoldTrial() {
    setErrorMsg(null);
    const result = await activateGoldTrial();
    if (result.ok) {
      setStatusMsg('Gold trial activated — head to Discover to explore!');
      await refreshSubscription();
    } else {
      setErrorMsg(result.error ?? 'Trial activation failed');
    }
  }

  const cards = useMemo(() => TIER_ORDER, []);
  const legacyPremium =
    hasLegacyPremium(dbUser) &&
    subscriptionState.effectiveTier !== 'FREE' &&
    (dbUser?.subscription_tier ?? 'FREE') === 'FREE';

  return (
    <div className="min-w-0 space-y-6 pb-24 min-[400px]:space-y-8 min-[400px]:pb-10">
      <TabPageHeader
        kicker="Membership"
        title="Choose your plan"
        description="Silver, Gold, and Platinum unlock more discovery, hosting, and trust tools. Same membership tiers as the LinkUp app."
        icon={<IoDiamondOutline size={22} />}
      />

      {statusMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-900">
          {statusMsg}
          <button type="button" className="ml-2 font-extrabold underline" onClick={() => setStatusMsg(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800">
          {errorMsg}
          <button type="button" className="ml-2 font-extrabold underline" onClick={() => setErrorMsg(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {legacyPremium && dbUser?.premium_until ? (
        <div className="linkup-card border border-border/80 bg-[#F5F6FA] p-4">
          <p className="text-[14px] font-extrabold text-foreground">Legacy premium active</p>
          <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
            You have legacy premium access until{' '}
            {new Date(dbUser.premium_until).toLocaleDateString(undefined, { dateStyle: 'medium' })}, giving you
            Silver-equivalent benefits. Subscribe to a current plan for continued access after this date.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'rounded-full px-4 py-2 text-[13px] font-extrabold transition',
              billingCycle === 'monthly' ? 'linkup-gradient-primary text-white' : 'text-muted'
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'rounded-full px-4 py-2 text-[13px] font-extrabold transition',
              billingCycle === 'annual' ? 'linkup-gradient-primary text-white' : 'text-muted'
            )}
          >
            Annual · save more
          </button>
        </div>
      </div>

      <div
        className={cn(
          'grid w-full min-w-0 grid-cols-1 gap-3 overflow-visible min-[400px]:gap-4 sm:grid-cols-2 xl:grid-cols-4',
          'items-stretch'
        )}
      >
        {cards.map((tier) => (
          <TierCard
            key={tier}
            tier={tier}
            billingCycle={billingCycle}
            effectiveTier={effective}
            paidTier={paidTier}
            isTrialActive={subscriptionState.isTrialActive && !subscriptionState.isPaidActive}
            trialDaysRemaining={subscriptionState.trialDaysRemaining}
            trialType={subscriptionState.trialType}
            checkoutBusy={checkoutBusy}
            cardRef={tier === 'GOLD' ? goldCardRef : undefined}
            onUpgrade={(t) => void handleUpgrade(t)}
            onDowngrade={() => setDowngradeOpen(true)}
            showGoldTrial={tier === 'GOLD' && showGoldTrial}
            trialBusy={trialBusy}
            onGoldTrial={() => void handleGoldTrial()}
          />
        ))}
      </div>

      <Link
        href="/subscription/history"
        className="flex items-center justify-between border-t border-border/60 py-3 text-[14px] font-semibold text-muted transition hover:text-foreground"
      >
        <span>View subscription history</span>
        <IoChevronForward size={18} />
      </Link>

      {subscriptionState.isPaidActive && paidTier !== 'FREE' ? (
        <p className="text-center">
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="text-[13px] font-semibold text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Cancel subscription
          </button>
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[var(--linkup-bottom-nav-offset)] z-40 border-t border-amber-200/80 bg-amber-50/95 p-3 shadow-lg lg:hidden">
        <button
          type="button"
          disabled={checkoutBusy || effective === 'GOLD'}
          onClick={() => void handleUpgrade('GOLD')}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-amber-500 text-[15px] font-extrabold text-white shadow-md disabled:opacity-50"
        >
          {checkoutBusy ? 'Opening checkout…' : 'Upgrade to Gold — most popular'}
        </button>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel subscription?"
        message={`You'll keep ${TIER_META[paidTier].label} access until ${
          subscriptionState.expiresAt
            ? new Date(subscriptionState.expiresAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'the end of your billing period'
        }. After that your account reverts to Free.`}
        confirmLabel={cancelBusy ? 'Cancelling…' : 'Cancel subscription'}
        cancelLabel="Keep plan"
        confirmVariant="danger"
        busy={cancelBusy}
        onConfirm={() => void handleCancel()}
        onClose={() => setCancelOpen(false)}
      />

      <ConfirmDialog
        open={downgradeOpen}
        title="Downgrade to Free?"
        message="You'll lose advanced filters, bookmarks, boosts, travel mode, and other tier features when your current period ends. You can resubscribe anytime."
        confirmLabel="Continue to cancel"
        cancelLabel="Not now"
        confirmVariant="danger"
        onConfirm={() => {
          setDowngradeOpen(false);
          setCancelOpen(true);
        }}
        onClose={() => setDowngradeOpen(false)}
      />
    </div>
  );
}

function TierCard({
  tier,
  billingCycle,
  effectiveTier,
  paidTier,
  isTrialActive,
  trialDaysRemaining,
  trialType,
  checkoutBusy,
  cardRef,
  onUpgrade,
  onDowngrade,
  showGoldTrial,
  trialBusy,
  onGoldTrial,
}: {
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  effectiveTier: SubscriptionTier;
  paidTier: SubscriptionTier;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  trialType: 'silver' | 'gold' | null;
  checkoutBusy: boolean;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  onUpgrade: (tier: PaidTier) => void;
  onDowngrade: () => void;
  showGoldTrial: boolean;
  trialBusy: boolean;
  onGoldTrial: () => void;
}) {
  const meta = TIER_META[tier];
  const features = TIER_CARD_FEATURES[tier];
  const isCurrent = effectiveTier === tier;
  const isHigher = tierRank(tier) > tierRank(effectiveTier);
  const isLower = tierRank(tier) < tierRank(effectiveTier);
  const price =
    tier === 'FREE'
      ? 'NGN 0'
      : meta.price
        ? billingCycle === 'annual'
          ? `${formatNgn(meta.price.annual)}/yr`
          : `${formatNgn(meta.price.monthly)}/month`
        : '';

  return (
    <div className={cn('relative flex h-full min-w-0 flex-col', tier === 'GOLD' && 'pt-4')}>
      {tier === 'GOLD' ? (
        <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-md">
          Most popular
        </span>
      ) : null}

      <div
        ref={cardRef}
        className={cn(
          'relative flex h-full min-w-0 flex-col rounded-[18px] border-2 p-4 shadow-[0_8px_28px_rgba(42,31,85,0.08)] min-[360px]:rounded-[22px] min-[400px]:p-5',
          meta.bgColor,
          meta.borderColor,
          tier === 'GOLD' && 'ring-2 ring-amber-400'
        )}
      >
      <div className="flex items-center gap-2">
        <TierBadge tier={tier} size="lg" />
        <h3 className={cn('font-display text-lg font-extrabold', meta.color)}>{meta.label}</h3>
      </div>

      <p className="mt-3 font-display text-2xl font-extrabold text-foreground">{price}</p>
      {billingCycle === 'annual' && meta.price ? (
        <p className="text-[12px] font-semibold text-muted">{meta.price.annualSaving}</p>
      ) : null}

      {isCurrent && isTrialActive ? (
        <p className="mt-1 text-[12px] font-extrabold text-primary">
          {trialDaysRemaining ?? 0} day{trialDaysRemaining === 1 ? '' : 's'} remaining
        </p>
      ) : null}

      <ul className="mt-4 min-h-0 flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] font-semibold text-foreground">
            <IoCheckmarkCircle className="mt-0.5 shrink-0 text-primary" size={14} />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2 pt-5">
        {isCurrent ? (
          <button
            type="button"
            disabled
            className="w-full rounded-full border-2 border-border bg-white/80 py-2.5 text-[13px] font-extrabold text-muted"
          >
            Current plan
          </button>
        ) : isHigher && tier !== 'FREE' ? (
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={() => onUpgrade(tier as PaidTier)}
            className={cn(
              'w-full rounded-full py-2.5 text-[13px] font-extrabold text-white shadow-sm disabled:opacity-50',
              tier === 'PLATINUM'
                ? 'bg-violet-600 hover:bg-violet-700'
                : tier === 'GOLD'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'linkup-gradient-primary'
            )}
          >
            {checkoutBusy ? 'Opening checkout…' : `Upgrade to ${meta.label.replace(' Explorer', '')}`}
          </button>
        ) : isLower && tier === 'FREE' && paidTier !== 'FREE' ? (
          <button
            type="button"
            onClick={onDowngrade}
            className="w-full rounded-full border border-red-200 bg-red-50 py-2.5 text-[13px] font-extrabold text-red-700"
          >
            Downgrade to Free
          </button>
        ) : isLower ? (
          <button
            type="button"
            disabled
            className="w-full rounded-full border border-border py-2.5 text-[13px] font-extrabold text-muted opacity-60"
          >
            Downgrade
          </button>
        ) : null}

        {showGoldTrial ? (
          <button
            type="button"
            disabled={trialBusy}
            onClick={onGoldTrial}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 py-2.5 text-[12px] font-extrabold text-amber-800"
          >
            <IoSparkles size={14} />
            {trialBusy ? 'Activating…' : 'Try Gold free for 7 days'}
          </button>
        ) : null}
      </div>
      </div>
    </div>
  );
}
