'use client';

import { PlanBudgetFeeNotifier } from '@/components/plans/PlanBudgetFeeNotifier';
import { GroupPlanSettingsSection } from '@/components/plans/create/GroupPlanSettingsSection';
import { GroupPlanPolicyGate } from '@/components/plans/GroupPlanPolicyGate';
import {
  MeetTypeSelectorSection,
  applyMeetTypeDefaults,
  isMoodMeetType,
} from '@/components/plans/create/MeetTypeSelectorSection';
import { TierBadge } from '@/components/subscription/TierBadge';
import { LocationSearchField } from '@/components/location/LocationSearchField';
import { ToggleSwitch } from '@/components/settings/ToggleRow';
import { Input } from '@/components/ui/Input';
import { useGatedAction, useUpgradeGate } from '@/contexts/UpgradeGateContext';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { usePermission } from '@/hooks/usePermission';
import { getMoodPlanCooldown } from '@/lib/plans/moodPlanCooldown';
import {
  isFridayActivation,
  type MoodListingHours,
} from '@/lib/plans/moodPlanComputations';
import { validateMultiCitySelection } from '@/lib/plans/nigerianCities';
import {
  clampMoodListingHours,
  MOOD_LISTING_OPTIONS,
  MOOD_REACH_LABELS,
  MOOD_WINDOW_CAP_HOURS,
  tierForListingHours,
} from '@/lib/plans/moodPlanTierConfig';
import { getFourthVisibilityOptionCopy, canCreatorSelectPremiumVisibility } from '@/lib/plans/tierRelativePremiumVisibility';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { createClient } from '@/lib/supabase/client';
import type { LocationSuggestion } from '@/lib/location/types';
import { requiresVerificationGate } from '@/lib/verification/access';
import { parsePublishPlanError, type PublishUpgradeNudge } from '@/lib/plans/publishPlanErrors';
import { MAX_ESCROW_TIER1_NGN } from '@/lib/plans/planFinancialConfig';
import { publishPlan } from '@/services/publishPlan.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoArrowBack, IoInformationCircleOutline, IoLocationOutline, IoLockClosed, IoShieldCheckmark, IoSparkles } from 'react-icons/io5';

const DURATIONS = [
  { m: 30, label: '30m' },
  { m: 60, label: '1h' },
  { m: 90, label: '1.5h' },
  { m: 120, label: '2h' },
  { m: 180, label: '3h+' },
] as const;

const MOOD_TYPES = ['Chill', 'Active', 'Social', 'Premium vibe'] as const;

const VISIBILITY_BASE = [
  { value: 'public' as const, title: 'Public', description: 'Anyone on LinkUp can discover this plan.' },
  { value: 'radius' as const, title: 'Within radius', description: 'Only visible to people within 50km of your meetup location.' },
  { value: 'friends' as const, title: 'Friends only', description: 'Connections only when friends ship.' },
];

const ESCROW: { id: EscrowPattern; label: string; sub: string }[] = [
  { id: 'A', label: 'Host funds', sub: 'You back the invite' },
  { id: 'B', label: 'Split', sub: 'Both contribute' },
  { id: 'C', label: 'Guest funds', sub: 'Tier 2 KYC' },
];

function defaultScheduled(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreatePlanScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [meetTypeId, setMeetTypeId] = useState<string | null>(null);
  const [selectedMeetType, setSelectedMeetType] = useState<DbMeetType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledLocal, setScheduledLocal] = useState(() => toLocalInputValue(defaultScheduled()));
  const [durationMinutes, setDurationMinutes] = useState<number | null>(60);
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState<LocationSuggestion | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'radius' | 'friends' | 'premium'>('public');
  const [isGroupPlan, setIsGroupPlan] = useState(false);
  const [maxGuests, setMaxGuests] = useState(4);
  const [maxFreeGuests, setMaxFreeGuests] = useState(5);
  const [maxPremiumGuests, setMaxPremiumGuests] = useState<number | null>(null);
  const [multiCity, setMultiCity] = useState(false);
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [cooldownNotice, setCooldownNotice] = useState<{ active: boolean; hoursRemaining?: number }>({
    active: false,
  });
  const [patternCWarning, setPatternCWarning] = useState(false);
  const [isMoodPlan, setIsMoodPlan] = useState(false);
  const [moodType, setMoodType] = useState<string>(MOOD_TYPES[0]);
  const [moodListingHours, setMoodListingHours] = useState<MoodListingHours>(3);
  const [isPaid, setIsPaid] = useState(true);
  const [startingPriceNgn, setStartingPriceNgn] = useState('');
  const [escrowPattern, setEscrowPattern] = useState<EscrowPattern>('A');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [spotlightBoost, setSpotlightBoost] = useState(false);
  const [hideFromDiscovery, setHideFromDiscovery] = useState(false);
  const [upgradeNudge, setUpgradeNudge] = useState<PublishUpgradeNudge>(null);
  const [busy, setBusy] = useState(false);
  const runGated = useGatedAction();
  const { showUpgradePrompt } = useUpgradeGate();
  const { subscriptionState } = useSubscriptionContext();
  const { allowed: spotlightAllowed } = usePermission('spotlight.profile', { checkQuota: true });
  const { allowed: canPatternB } = usePermission('escrow.pattern_b');
  const { allowed: canPatternC } = usePermission('escrow.pattern_c');
  const { effectiveTier: moodTier } = usePermission('mood_plan.activate');
  const effectiveTier = moodTier ?? subscriptionState.effectiveTier;
  const canSelectPremiumVisibility = canCreatorSelectPremiumVisibility(effectiveTier);

  const fourthOptionCopy = getFourthVisibilityOptionCopy(effectiveTier);
  const visibilityOptions = useMemo(
    () => [
      ...VISIBILITY_BASE,
      {
        value: 'premium' as const,
        title: fourthOptionCopy.label,
        description: fourthOptionCopy.description,
        tierBadge: fourthOptionCopy.tierBadge,
      },
    ],
    [fourthOptionCopy]
  );
  const windowCap = MOOD_WINDOW_CAP_HOURS[effectiveTier] ?? 24;
  const [error, setError] = useState<string | null>(null);
  const [showCityValidation, setShowCityValidation] = useState(false);
  const amountNgn = parseFloat(startingPriceNgn.replace(/,/g, '')) || 0;

  useEffect(() => {
    if (!isMoodPlan) return;
    const clamped = clampMoodListingHours(moodListingHours, effectiveTier);
    if (clamped !== moodListingHours) setMoodListingHours(clamped);
  }, [isMoodPlan, moodListingHours, effectiveTier]);

  const { data: profileBundle } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const verificationBlocked = requiresVerificationGate(
    profileBundle?.dbUser?.verification_status,
    { verifiedBadge: profileBundle?.profile?.verified_badge }
  );

  function handleMeetTypeSelect(mt: DbMeetType) {
    const defaults = applyMeetTypeDefaults(mt);
    setMeetTypeId(mt.id);
    setSelectedMeetType(mt);
    setDurationMinutes(defaults.durationMinutes);
    setEscrowPattern(defaults.escrowPattern);
    setIsGroupPlan(defaults.isGroupPlan);
    if (!defaults.isGroupPlan) {
      setMultiCity(false);
      setCityIds([]);
    }
    if (!defaults.isMoodMeetType) {
      setIsMoodPlan(false);
      setCooldownNotice({ active: false });
    }
  }

  const showMoodPlanOptions = isMoodMeetType(selectedMeetType);

  async function handleMoodToggle(checked: boolean) {
    if (!checked) {
      setCooldownNotice({ active: false });
      setIsMoodPlan(false);
      return;
    }
    if (user?.id) {
      const result = await getMoodPlanCooldown(user.id);
      if (result.in_cooldown) {
        setCooldownNotice({ active: true, hoursRemaining: result.hours_remaining });
        return;
      }
    }
    setCooldownNotice({ active: false });
    setIsMoodPlan(true);
  }

  function selectListingHours(h: MoodListingHours) {
    if (h > windowCap) {
      const need = tierForListingHours(h);
      if (need) void runGated('mood_plan.activate', () => {});
      return;
    }
    setMoodListingHours(h);
  }

  function selectEscrow(pattern: EscrowPattern) {
    if (pattern === 'A') {
      setEscrowPattern('A');
      setPatternCWarning(false);
      return;
    }
    if (pattern === 'B') {
      void runGated('escrow.pattern_b', () => setEscrowPattern('B'));
      return;
    }
    void runGated('escrow.pattern_c', () => {
      const kycTier = profileBundle?.dbUser?.kyc_tier ?? 0;
      if (kycTier < 2) {
        setEscrowPattern('A');
        setPatternCWarning(true);
        return;
      }
      setPatternCWarning(false);
      setEscrowPattern('C');
    });
  }

  function selectVisibility(value: 'public' | 'radius' | 'friends' | 'premium') {
    if (value === 'premium' && !canSelectPremiumVisibility) {
      showUpgradePrompt({
        feature: 'visibility.tier_audience',
        requiredTier: 'SILVER',
        currentTier: effectiveTier,
      });
      return;
    }
    setVisibility(value);
  }

  async function handlePublish() {
    setError(null);
    if (verificationBlocked) {
      setError('Complete verification in Trust settings before publishing.');
      return;
    }
    if (!user?.id) return;
    if (!meetTypeId) {
      setError('Pick a meet type.');
      return;
    }

    const scheduledAt = isMoodPlan ? new Date() : new Date(scheduledLocal);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError('Set a valid date and time.');
      return;
    }
    if (isGroupPlan && multiCity) {
      const cityErr = validateMultiCitySelection(cityIds);
      if (cityErr) {
        setShowCityValidation(true);
        setError(cityErr);
        return;
      }
    }
    setShowCityValidation(false);

    setUpgradeNudge(null);
    setBusy(true);
    const { planId, error: pubErr } = await publishPlan(createClient(), user.id, {
      meetTypeId,
      title,
      description,
      locationLabel,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      scheduledAt,
      durationMinutes,
      visibility,
      isPaid: isMoodPlan ? false : isPaid,
      startingPriceNgn,
      escrowPattern: isPaid ? escrowPattern : null,
      hostContributionBps: 5000,
      isMoodPlan,
      moodType,
      moodListingHours,
      spotlightBoost: spotlightAllowed ? spotlightBoost : false,
      premiumSubscriber: spotlightAllowed,
      hideFromDiscovery,
      isGroupPlan,
      maxGuests: isGroupPlan ? maxGuests : null,
      maxFreeGuests: isGroupPlan ? maxFreeGuests : null,
      maxPremiumGuests: isGroupPlan ? maxPremiumGuests : null,
      multiCity: isGroupPlan && multiCity,
      cityIds: isGroupPlan ? cityIds : [],
      isNegotiable,
    });
    setBusy(false);

    if (pubErr) {
      const parsed = parsePublishPlanError(pubErr);
      setError(parsed.userMessage);
      if (parsed.nudge) setUpgradeNudge(parsed.nudge);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['creator-plans'] });
    await queryClient.invalidateQueries({ queryKey: ['discover'] });
    if (planId) router.push(`/plan/${planId}`);
    else router.push('/plan-management');
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to create a plan.
      </p>
    );
  }

  return (
    <GroupPlanPolicyGate active={isGroupPlan}>
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-4">
        <Link
          href="/plan-management"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 shadow-sm transition hover:bg-[#EDE8FF]/60"
          aria-label="Back to plan management"
        >
          <IoArrowBack size={22} />
        </Link>
        <header>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">New meetup</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Create plan</h1>
        </header>
      </div>

      {verificationBlocked ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-semibold text-amber-900">
          Verification required before publishing.{' '}
          <Link href="/trust" className="font-extrabold text-primary underline">
            Complete trust & verification
          </Link>
        </p>
      ) : null}

      <PremiumSectionHead title="When & how you'll meet" />

      <div className="linkup-card space-y-4 p-5">
        <MeetTypeSelectorSection meetTypeId={meetTypeId} onSelect={handleMeetTypeSelect} />

        {showMoodPlanOptions ? (
          <>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-foreground">Mood plan</p>
                <p className="text-[13px] font-semibold text-muted">Short-lived spark in Discover</p>
              </div>
              <ToggleSwitch
                id="mood-plan"
                checked={isMoodPlan}
                onChange={(v) => void handleMoodToggle(v)}
              />
            </div>

            {cooldownNotice.active ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-[13px] font-semibold text-amber-900">
                  Your next Mood Plan is available in{' '}
                  <span className="font-extrabold">{cooldownNotice.hoursRemaining ?? 0} hours</span>.
                </p>
                {['FREE', 'SILVER'].includes(effectiveTier) ? (
                  <Link
                    href="/subscription"
                    className="mt-1 inline-block text-[12px] font-extrabold text-amber-800 underline"
                  >
                    Upgrade to reduce cooldown →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {isGroupPlan && (
          <GroupPlanSettingsSection
            visible={isGroupPlan}
            showCityValidation={showCityValidation}
            draft={{ isGroupPlan, maxGuests, maxFreeGuests, maxPremiumGuests, multiCity, cityIds }}
            onChange={(patch) => {
              if (patch.maxGuests != null) setMaxGuests(patch.maxGuests);
              if (patch.maxFreeGuests != null) setMaxFreeGuests(patch.maxFreeGuests);
              if (patch.maxPremiumGuests !== undefined) setMaxPremiumGuests(patch.maxPremiumGuests);
              if (patch.multiCity != null) setMultiCity(patch.multiCity);
              if (patch.cityIds != null) setCityIds(patch.cityIds);
            }}
          />
        )}

        {isMoodPlan ? (
          <div className="space-y-3">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Mood label</p>
            <div className="flex flex-wrap gap-2">
              {MOOD_TYPES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoodType(m)}
                  className={cn(
                    'rounded-full px-3 py-2 text-[13px] font-extrabold',
                    moodType === m ? 'bg-secondary/15 text-secondary' : 'bg-primary/5 text-muted'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Listing hours</p>
            <div className="flex flex-wrap gap-2">
              {MOOD_LISTING_OPTIONS.map(({ h, label }) => {
                const locked = h > windowCap;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => selectListingHours(h)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-extrabold',
                      moodListingHours === h && !locked
                        ? 'linkup-gradient-primary text-white'
                        : 'bg-primary/10 text-primary',
                      locked && 'opacity-50'
                    )}
                  >
                    {label}
                    {locked ? <IoLockClosed size={12} /> : null}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
              <IoLocationOutline size={16} className="shrink-0 text-primary" />
              <span>
                Your reach:{' '}
                <span className="font-extrabold text-foreground">{MOOD_REACH_LABELS[effectiveTier]}</span>
              </span>
            </div>
            {isMoodPlan && ['GOLD', 'PLATINUM'].includes(effectiveTier) && isFridayActivation() ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[12px] font-extrabold text-amber-800">
                <IoSparkles size={14} />
                Weekend Plan
                <span className="font-semibold text-amber-600">· visible through the weekend</span>
              </div>
            ) : null}
          </div>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-wide text-muted">
              Date & time
            </span>
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] font-semibold"
            />
          </label>
        )}

        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.m}
              type="button"
              onClick={() => setDurationMinutes(d.m)}
              className={cn(
                'rounded-full px-4 py-2 text-[13px] font-extrabold',
                durationMinutes === d.m ? 'linkup-gradient-primary text-white' : 'bg-primary/10 text-primary'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <PremiumSectionHead title="Story & place" />

      <div className="linkup-card space-y-4 p-5">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dinner in Lekki tonight"
        />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-wide text-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What should people expect?"
            className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] font-semibold outline-none focus:border-primary/40"
          />
        </label>
        <LocationSearchField
          label="Location"
          value={locationLabel}
          onChange={setLocationLabel}
          onSelect={(s) => setCoords(s)}
          placeholder="Search with Google Places…"
        />
      </div>

      <PremiumSectionHead title="Visibility" />

      <div className="space-y-2" role="radiogroup" aria-label="Plan visibility">
        {visibilityOptions.map((opt) => {
          const selected = visibility === opt.value;
          const isPremiumOpt = opt.value === 'premium';
          const locked = isPremiumOpt && !canSelectPremiumVisibility;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectVisibility(opt.value)}
              className={cn(
                'relative w-full rounded-2xl border-2 p-4 text-left transition active:scale-[0.995]',
                selected
                  ? 'border-primary bg-[#EDE8FF]/70 shadow-md ring-2 ring-primary/25'
                  : 'border-border bg-white hover:border-primary/30 hover:bg-[#F8F7FF]/80',
                locked && 'opacity-60'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={cn('text-[15px] font-extrabold', selected ? 'text-primary' : 'text-foreground')}>
                  {opt.title}
                </p>
                {locked && fourthOptionCopy.tierBadge ? (
                  <TierBadge tier={fourthOptionCopy.tierBadge} size="sm" />
                ) : null}
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-primary bg-primary' : 'border-border bg-white'
                  )}
                  aria-hidden
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-muted">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {!isMoodPlan ? (
        <>
          <PremiumSectionHead title="Commitment & escrow" />
          <div className="linkup-card space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-extrabold text-foreground">Paid plan</span>
              <ToggleSwitch id="paid-plan" checked={isPaid} onChange={setIsPaid} />
            </div>
            {isPaid ? (
              <>
                <Input
                  label="Starting price (NGN)"
                  value={startingPriceNgn}
                  onChange={(e) => setStartingPriceNgn(e.target.value)}
                  inputMode="decimal"
                />
                <PlanBudgetFeeNotifier
                  budgetCents={Math.round(amountNgn * 100)}
                  participantCount={isGroupPlan ? maxGuests + 1 : 1}
                  isGroupPlan={isGroupPlan}
                />
                {amountNgn > MAX_ESCROW_TIER1_NGN ? (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <IoShieldCheckmark className="mt-0.5 shrink-0 text-violet-600" size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-extrabold text-violet-800">Platinum required</p>
                      <p className="mt-0.5 text-[12px] font-semibold text-violet-600">
                        Agreements above ₦5,000,000 require a Platinum subscription and Tier 3 identity
                        verification.
                      </p>
                    </div>
                    <TierBadge tier="PLATINUM" size="sm" className="ml-auto shrink-0" />
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-3">
                  {ESCROW.map((e) => {
                    const locked =
                      (e.id === 'B' && !canPatternB) || (e.id === 'C' && !canPatternC);
                    const tier = e.id === 'B' ? 'SILVER' : e.id === 'C' ? 'GOLD' : null;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => selectEscrow(e.id)}
                        className={cn(
                          'relative rounded-2xl border p-3 text-left',
                          escrowPattern === e.id
                            ? 'border-primary/40 bg-[#EDE8FF]/50'
                            : 'border-border hover:border-primary/20',
                          locked && 'opacity-60'
                        )}
                      >
                        {tier && locked ? (
                          <span className="absolute right-2 top-2">
                            <TierBadge tier={tier} size="sm" />
                          </span>
                        ) : null}
                        <p className="text-[14px] font-extrabold text-foreground">{e.label}</p>
                        <p className="text-[12px] font-semibold text-muted">{e.sub}</p>
                      </button>
                    );
                  })}
                </div>
                {(escrowPattern === 'B' || escrowPattern === 'C') ? (
                  <div className="space-y-3 border-t border-border/60 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <p className="text-[15px] font-extrabold text-foreground">Allow price negotiation</p>
                        <p className="text-[12px] font-semibold text-muted">
                          {isNegotiable
                            ? 'Guests can make offers and negotiate the price with you.'
                            : 'Guests request to join at the formula price. You approve or decline each request.'}
                        </p>
                      </div>
                      <ToggleSwitch
                        id="plan-negotiable"
                        checked={isNegotiable}
                        onChange={setIsNegotiable}
                      />
                    </div>
                    {!isNegotiable ? (
                      <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-[#EDE8FF]/50 p-3">
                        <IoInformationCircleOutline className="mt-0.5 shrink-0 text-primary" size={16} />
                        <p className="text-[12px] font-semibold leading-relaxed text-primary">
                          Guests will see the formula share price and can request to join. You will receive a
                          notification for each request and can approve or decline.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {patternCWarning ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[13px] font-semibold text-amber-900">
                    Pattern C requires Tier 2 identity verification. Your plan will use Pattern A until Tier
                    2 is complete.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="linkup-card flex items-center gap-3 p-4">
        <IoSparkles className="shrink-0 text-primary" size={22} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-foreground">Spotlight boost</p>
          <p className="text-[13px] font-semibold text-muted">Extra feed placement while publishing</p>
        </div>
        <ToggleSwitch
          id="spotlight-boost"
          checked={spotlightBoost}
          onChange={(v) => {
            if (!v) {
              setSpotlightBoost(false);
              return;
            }
            void runGated('spotlight.profile', () => setSpotlightBoost(true));
          }}
        />
      </div>

      <div className="linkup-card flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-foreground">Hide from discovery browse</p>
          <p className="text-[13px] font-semibold text-muted">Platinum: share via link only</p>
        </div>
        <ToggleSwitch
          id="plan-privacy"
          checked={hideFromDiscovery}
          onChange={(v) => {
            if (!v) {
              setHideFromDiscovery(false);
              return;
            }
            void runGated('privacy.plan_creation', () => setHideFromDiscovery(true));
          }}
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || verificationBlocked}
        onClick={() => void handlePublish()}
        className="flex w-full min-h-[56px] items-center justify-center rounded-full linkup-gradient-primary text-[17px] font-extrabold text-white shadow-lg transition hover:opacity-95 disabled:opacity-45"
      >
        {busy ? 'Publishing…' : 'Publish plan'}
      </button>

      {upgradeNudge ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-[14px] font-semibold text-amber-800">
            This escrow pattern requires a{' '}
            <span className="font-extrabold">{upgradeNudge.tier}</span> subscription.
          </p>
          <Link
            href="/subscription"
            className="mt-2 inline-flex items-center text-[14px] font-extrabold text-amber-700 underline hover:text-amber-900"
          >
            View plans →
          </Link>
        </div>
      ) : null}

      <p className="text-center text-[13px] font-semibold text-muted">
        Uses the same <span className="font-extrabold text-primary">publish_plan</span> RPC as the mobile app.
      </p>
    </div>
    </GroupPlanPolicyGate>
  );
}
