'use client';

import {
  formatFilterPriceMajor,
  parseFilterPriceMajor,
  validateDiscoverPriceRange,
} from '@/lib/discovery/feedPriceFilter';
import {
  hasAdvancedDiscoverFilters,
  type FeedFilterState,
} from '@/lib/discovery/feedFilters';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { cn } from '@/utils/cn';
import { TierBadge } from '@/components/subscription/TierBadge';
import { useGatedAction, useUpgradeGate } from '@/contexts/UpgradeGateContext';
import {
  clampMaxDistanceKm,
  nextTierForWiderRadius,
  SLIDER_MAX_KM,
  sliderMaxKmForTier,
} from '@/lib/plans/discoveryRadius';
import { TIER_META } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IoFunnel, IoLockClosed } from 'react-icons/io5';

const MOODS: { id: DiscoveryMood; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'chill', label: 'Chill' },
  { id: 'active', label: 'Active' },
  { id: 'social', label: 'Social' },
  { id: 'premium', label: 'Premium' },
];

const PRESENCE_OPTIONS = [
  { id: 'all' as const, label: 'All hosts' },
  { id: 'online' as const, label: 'Online now' },
  { id: 'offline' as const, label: 'Offline' },
];

type Props = {
  filter: FeedFilterState;
  mood: DiscoveryMood;
  baseRadiusKm: number;
  sliderMaxKm?: number;
  effectiveTier?: SubscriptionTier;
  advancedFiltersAllowed: boolean;
  onApply: (filter: FeedFilterState, mood: DiscoveryMood) => void;
  /** Inside ContextPanel Discover filter rail — no card chrome or duplicate title. */
  embedded?: boolean;
  /** Mobile bottom sheet — compact padding, no sticky card. */
  sheet?: boolean;
  /** Called after Apply or Reset (e.g. close mobile sheet). */
  onApplied?: () => void;
  className?: string;
};

export function DiscoverFilterPanel({
  filter,
  mood,
  baseRadiusKm,
  sliderMaxKm: sliderMaxKmProp,
  effectiveTier = 'FREE',
  advancedFiltersAllowed,
  onApply,
  embedded,
  sheet,
  onApplied,
  className,
}: Props) {
  const sliderMax = sliderMaxKmProp ?? sliderMaxKmForTier(effectiveTier);
  const [draft, setDraft] = useState(filter);
  const [draftMood, setDraftMood] = useState(mood);
  const [distanceTouched, setDistanceTouched] = useState(() => filter.maxDistanceKm != null);
  const [minPriceText, setMinPriceText] = useState(() => formatFilterPriceMajor(filter.minPriceCents));
  const [maxPriceText, setMaxPriceText] = useState(() => formatFilterPriceMajor(filter.maxPriceCents));
  const [priceError, setPriceError] = useState<string | null>(null);
  const { checkFeaturePermission } = useUpgradeGate();
  const runGated = useGatedAction();

  useEffect(() => {
    setDraft({
      ...filter,
      maxDistanceKm: filter.maxDistanceKm ?? null,
    });
    setDraftMood(mood);
    setDistanceTouched(filter.maxDistanceKm != null);
    setMinPriceText(formatFilterPriceMajor(filter.minPriceCents));
    setMaxPriceText(formatFilterPriceMajor(filter.maxPriceCents));
  }, [filter, mood]);

  useEffect(() => {
    setDraft((d) => {
      if (d.maxDistanceKm == null) return d;
      const clamped = clampMaxDistanceKm(d.maxDistanceKm, effectiveTier);
      return clamped === d.maxDistanceKm ? d : { ...d, maxDistanceKm: clamped };
    });
  }, [effectiveTier]);

  async function apply() {
    const minPriceCents = parseFilterPriceMajor(minPriceText);
    const maxPriceCents = parseFilterPriceMajor(maxPriceText);
    const priceRangeError = validateDiscoverPriceRange(minPriceCents, maxPriceCents);
    if (priceRangeError) {
      setPriceError(priceRangeError);
      return;
    }
    const usesAdvanced =
      minPriceCents != null ||
      maxPriceCents != null ||
      draft.hostPresence !== 'all' ||
      draft.verifiedHostsOnly;
    if (usesAdvanced && !advancedFiltersAllowed) {
      const { allowed } = await checkFeaturePermission('discover.advanced_filters');
      if (!allowed) {
        setPriceError('Upgrade to Silver to use price and verified-host filters.');
        return;
      }
    }
    setPriceError(null);
    const maxDistanceKm =
      distanceTouched && draft.maxDistanceKm != null
        ? clampMaxDistanceKm(draft.maxDistanceKm, effectiveTier)
        : null;
    const distanceFilterActive = maxDistanceKm != null;
    const verifiedHostsOnly = advancedFiltersAllowed ? draft.verifiedHostsOnly : false;
    const hasOtherConstraints = hasAdvancedDiscoverFilters({
      minPriceCents,
      maxPriceCents,
      verifiedHostsOnly,
      hostPresence: draft.hostPresence,
    });
    const next: FeedFilterState = {
      maxDistanceKm,
      minPriceCents,
      maxPriceCents,
      verifiedHostsOnly,
      hostPresence: draft.hostPresence,
      clientFiltersActive: distanceFilterActive || hasOtherConstraints,
    };
    onApply(next, draftMood);
    onApplied?.();
  }

  async function onVerifiedHostsChange(checked: boolean) {
    if (checked && !advancedFiltersAllowed) {
      const { allowed } = await checkFeaturePermission('discover.advanced_filters');
      if (!allowed) return;
    }
    setDraft((d) => ({ ...d, verifiedHostsOnly: checked }));
  }

  function reset() {
    const next = {
      maxDistanceKm: null,
      minPriceCents: null,
      maxPriceCents: null,
      verifiedHostsOnly: false,
      hostPresence: 'all' as const,
      clientFiltersActive: false,
    };
    setDraft(next);
    setDraftMood('all');
    setDistanceTouched(false);
    setMinPriceText('');
    setMaxPriceText('');
    setPriceError(null);
    onApply(next, 'all');
    onApplied?.();
  }

  const nextTier = nextTierForWiderRadius(effectiveTier);
  const distanceSet = distanceTouched && draft.maxDistanceKm != null;
  const sliderValue = distanceSet ? Math.min(draft.maxDistanceKm!, sliderMax) : 0;
  const distanceLabel = distanceSet ? `${sliderValue} km` : 'Any distance';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 min-[360px]:gap-5',
        embedded ? '' : sheet ? '' : 'linkup-card sticky top-4 p-4 min-[360px]:p-5',
        className
      )}
    >
      {!embedded && !sheet ? (
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <IoFunnel size={18} className="text-primary" />
          <h2 className="font-display text-lg font-extrabold text-foreground">Filters</h2>
        </div>
      ) : sheet ? null : (
        <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-secondary">
          <IoFunnel size={14} />
          Feed filters
        </p>
      )}

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Vibe</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setDraftMood(m.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-extrabold transition',
                draftMood === m.id
                  ? 'linkup-gradient-primary text-white shadow-sm'
                  : 'border border-border bg-surface text-muted hover:border-primary/30'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Distance</p>
          <span
            className={cn(
              'text-[13px] font-extrabold',
              distanceSet ? 'text-primary' : 'text-muted'
            )}
          >
            {distanceLabel}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={1}
          value={sliderValue}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next <= 0) {
              setDistanceTouched(false);
              setDraft((d) => ({ ...d, maxDistanceKm: null }));
              return;
            }
            setDistanceTouched(true);
            setDraft((d) => ({
              ...d,
              maxDistanceKm: clampMaxDistanceKm(next, effectiveTier),
            }));
          }}
          className={cn('w-full accent-primary', !distanceSet && 'opacity-60')}
        />
        {distanceSet ? (
          <button
            type="button"
            onClick={() => {
              setDistanceTouched(false);
              setDraft((d) => ({ ...d, maxDistanceKm: null }));
            }}
            className="mt-1 text-[11px] font-extrabold text-primary underline"
          >
            Clear distance
          </button>
        ) : null}
        {effectiveTier !== 'PLATINUM' ? (
          <button
            type="button"
            onClick={() => runGated('discover.wider_radius', () => {})}
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-border/80 bg-[#F5F6FA] px-3 py-2 transition hover:bg-[#EDE8FF]/40"
          >
            <span className="text-left text-[11px] font-semibold text-muted">
              Search up to {SLIDER_MAX_KM[nextTier]}km on {TIER_META[nextTier].label}
            </span>
            <TierBadge tier={nextTier} size="sm" />
          </button>
        ) : (
          <p className="mt-1 text-[11px] font-semibold text-muted">
            Your {TIER_META.PLATINUM.label} plan searches up to {sliderMax}km.
          </p>
        )}
        <p className="mt-1 text-[11px] font-semibold text-muted">
          Distance uses your search location and each plan&apos;s meetup pin.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Price (₦)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Min"
            value={minPriceText}
            onChange={(e) => setMinPriceText(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-semibold outline-none focus:border-primary/40"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Max"
            value={maxPriceText}
            onChange={(e) => setMaxPriceText(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-semibold outline-none focus:border-primary/40"
          />
        </div>
        {priceError ? (
          <p className="mt-1 text-[12px] font-semibold text-[#EF4444]">{priceError}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Host presence</p>
        <div className="flex flex-wrap gap-2">
          {PRESENCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, hostPresence: opt.id }))}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-extrabold transition',
                draft.hostPresence === opt.id
                  ? 'border-primary bg-[#EDE8FF] text-primary'
                  : 'border border-border text-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] font-semibold text-muted">
          Presence filtering matches the app when host heartbeat data is available.
        </p>
      </div>

      <label
        className={cn(
          'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3',
          advancedFiltersAllowed ? 'border-border' : 'border-border bg-[#F9FAFB]'
        )}
      >
        <span className="text-[13px] font-extrabold text-foreground">Verified hosts only</span>
        <input
          type="checkbox"
          checked={draft.verifiedHostsOnly}
          onChange={(e) => void onVerifiedHostsChange(e.target.checked)}
          className="relative z-10 h-5 w-5 shrink-0 cursor-pointer accent-primary"
        />
      </label>
      {!advancedFiltersAllowed ? (
        <p className="-mt-3 text-[11px] font-semibold text-muted">
          <IoLockClosed className="mr-1 inline" size={12} />
          <Link href="/subscription?tier=SILVER" className="font-extrabold text-primary underline">
            Upgrade to Silver
          </Link>{' '}
          for advanced filters.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={apply}
          className="w-full rounded-full linkup-gradient-primary py-2.5 text-[14px] font-extrabold text-white shadow-md"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-full border border-border py-2.5 text-[14px] font-extrabold text-muted"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
