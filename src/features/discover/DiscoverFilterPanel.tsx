'use client';

import { formatFilterPriceMajor, parseFilterPriceMajor } from '@/lib/discovery/feedPriceFilter';
import {
  isDiscoverFilterConstraintActive,
  type FeedFilterState,
} from '@/lib/discovery/feedFilters';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { cn } from '@/utils/cn';
import { TierBadge } from '@/components/subscription/TierBadge';
import { useGatedAction, useUpgradeGate } from '@/contexts/UpgradeGateContext';
import { effectiveDiscoveryRadiusKm } from '@/lib/plans/discoveryRadius';
import { TIER_META } from '@/lib/subscription/constants';
import type { SubscriptionTier } from '@/lib/subscription/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IoFunnel, IoLockClosed, IoNavigateOutline } from 'react-icons/io5';

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
  browseRadiusKm?: number;
  hasWiderRadius?: boolean;
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
  browseRadiusKm = baseRadiusKm,
  hasWiderRadius = false,
  effectiveTier = 'FREE',
  advancedFiltersAllowed,
  onApply,
  embedded,
  sheet,
  onApplied,
  className,
}: Props) {
  const [draft, setDraft] = useState(filter);
  const [draftMood, setDraftMood] = useState(mood);
  const [minPriceText, setMinPriceText] = useState(() => formatFilterPriceMajor(filter.minPriceCents));
  const [maxPriceText, setMaxPriceText] = useState(() => formatFilterPriceMajor(filter.maxPriceCents));
  const [priceError, setPriceError] = useState<string | null>(null);
  const { checkFeaturePermission } = useUpgradeGate();
  const runGated = useGatedAction();

  useEffect(() => {
    setDraft(filter);
    setDraftMood(mood);
    setMinPriceText(formatFilterPriceMajor(filter.minPriceCents));
    setMaxPriceText(formatFilterPriceMajor(filter.maxPriceCents));
  }, [filter, mood]);

  async function apply() {
    const minPriceCents = parseFilterPriceMajor(minPriceText);
    const maxPriceCents = parseFilterPriceMajor(maxPriceText);
    if (minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents) {
      setPriceError('Minimum price cannot be higher than maximum.');
      return;
    }
    const usesAdvanced =
      minPriceCents != null ||
      maxPriceCents != null ||
      draft.hostPresence !== 'all' ||
      draft.verifiedHostsOnly;
    if (usesAdvanced && !advancedFiltersAllowed) {
      const { allowed } = await checkFeaturePermission('discover.advanced_filters');
      if (!allowed) return;
    }
    setPriceError(null);
    const next: FeedFilterState = {
      maxDistanceKm: draft.maxDistanceKm,
      minPriceCents,
      maxPriceCents,
      verifiedHostsOnly: advancedFiltersAllowed ? draft.verifiedHostsOnly : false,
      hostPresence: draft.hostPresence,
      clientFiltersActive: isDiscoverFilterConstraintActive(
        {
          maxDistanceKm: draft.maxDistanceKm,
          minPriceCents,
          maxPriceCents,
          verifiedHostsOnly: advancedFiltersAllowed ? draft.verifiedHostsOnly : false,
          hostPresence: draft.hostPresence,
        },
        baseRadiusKm
      ),
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
      maxDistanceKm: baseRadiusKm,
      minPriceCents: null,
      maxPriceCents: null,
      verifiedHostsOnly: false,
      hostPresence: 'all' as const,
      clientFiltersActive: false,
    };
    setDraft(next);
    setDraftMood('all');
    setMinPriceText('');
    setMaxPriceText('');
    setPriceError(null);
    onApply(next, 'all');
    onApplied?.();
  }

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
          <span className="text-[13px] font-extrabold text-primary">{draft.maxDistanceKm} km</span>
        </div>
        <input
          type="range"
          min={5}
          max={Math.max(200, browseRadiusKm, baseRadiusKm, draft.maxDistanceKm)}
          step={5}
          value={draft.maxDistanceKm}
          onChange={(e) =>
            setDraft((d) => ({ ...d, maxDistanceKm: Number(e.target.value) }))
          }
          className="w-full accent-primary"
        />
        {hasWiderRadius && effectiveTier !== 'FREE' ? (
          <p className="mt-1 text-[11px] font-semibold text-muted">
            Your {TIER_META[effectiveTier].label} subscription extends your reach to{' '}
            <span className="font-extrabold text-foreground">
              {effectiveDiscoveryRadiusKm(baseRadiusKm, effectiveTier, true)} km
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => runGated('discover.wider_radius', () => {})}
            className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted transition hover:text-foreground"
          >
            <IoNavigateOutline size={14} className="text-primary" />
            Wider reach available on Silver
            <TierBadge tier="SILVER" size="sm" />
          </button>
        )}
        <p className="mt-1 text-[11px] font-semibold text-muted">
          Uses your profile location when plans have map coordinates.
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
