'use client';

import { GradientChip } from '@/components/settings/GradientChip';
import {
  defaultMatchMakerFilter,
  isMatchMakerFilterActive,
  type MatchMakerFilterState,
  type MatchMakerSortBy,
} from '@/lib/matchmaker/filterState';
import { clampMaxDistanceKm } from '@/lib/plans/discoveryRadius';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';
import { IoFunnel } from 'react-icons/io5';

type Props = {
  filter: MatchMakerFilterState;
  baseRadiusKm: number;
  sliderMaxKm: number;
  effectiveTier: SubscriptionTier;
  onApply: (next: MatchMakerFilterState) => void;
  /** Inside ContextPanel right rail — no card chrome. */
  embedded?: boolean;
  /** Mobile bottom sheet — compact padding. */
  sheet?: boolean;
  onApplied?: () => void;
  className?: string;
};

export function MatchMakerFilterPanel({
  filter,
  baseRadiusKm,
  sliderMaxKm,
  effectiveTier,
  onApply,
  embedded,
  sheet,
  onApplied,
  className,
}: Props) {
  const [maxKm, setMaxKm] = useState<number | null>(filter.maxDistanceKm);
  const [sortBy, setSortBy] = useState<MatchMakerSortBy>(filter.sortBy);
  const [distanceTouched, setDistanceTouched] = useState(() => filter.maxDistanceKm != null);

  useEffect(() => {
    setMaxKm(filter.maxDistanceKm);
    setSortBy(filter.sortBy);
    setDistanceTouched(filter.maxDistanceKm != null);
  }, [filter]);

  function buildNext(): MatchMakerFilterState {
    const appliedMaxKm =
      distanceTouched && maxKm != null ? clampMaxDistanceKm(maxKm, effectiveTier) : null;
    return {
      maxDistanceKm: appliedMaxKm,
      sortBy,
      filterActive: isMatchMakerFilterActive({ maxDistanceKm: appliedMaxKm, sortBy }),
    };
  }

  function apply() {
    onApply(buildNext());
    onApplied?.();
  }

  function reset() {
    onApply(defaultMatchMakerFilter());
    setMaxKm(null);
    setSortBy('best_match');
    setDistanceTouched(false);
    onApplied?.();
  }

  const distanceSet = distanceTouched && maxKm != null && maxKm > 0;
  const distanceLabel = distanceSet ? `Up to ${maxKm} km` : 'No distance limit';
  const sliderValue = distanceSet ? maxKm! : 0;

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
          <h2 className="font-display text-lg font-extrabold text-foreground">Filter MatchMaker</h2>
        </div>
      ) : sheet ? null : (
        <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-secondary">
          <IoFunnel size={14} />
          Pool filters
        </p>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Distance</p>
          <span
            className={cn('text-[13px] font-extrabold', distanceSet ? 'text-primary' : 'text-muted')}
          >
            {distanceLabel}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={sliderMaxKm}
          step={1}
          value={sliderValue}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next <= 0) {
              setDistanceTouched(false);
              setMaxKm(null);
              return;
            }
            setDistanceTouched(true);
            setMaxKm(clampMaxDistanceKm(next, effectiveTier));
          }}
          className={cn('w-full accent-primary', !distanceSet && 'opacity-60')}
        />
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-muted">
          <span>No limit</span>
          <span>{sliderMaxKm} km</span>
        </div>
        {distanceSet ? (
          <button
            type="button"
            onClick={() => {
              setDistanceTouched(false);
              setMaxKm(null);
            }}
            className="mt-1 text-[11px] font-extrabold text-primary underline"
          >
            Clear distance
          </button>
        ) : null}
        <p className="mt-1 text-[11px] font-semibold text-muted">
          Requires location on your profile. Default browse radius: {baseRadiusKm} km.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Sort by</p>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          {(
            [
              { id: 'best_match' as const, label: 'Best match' },
              { id: 'recently_joined' as const, label: 'Recently joined' },
            ] as const
          ).map((opt) => (
            <GradientChip
              key={opt.id}
              label={opt.label}
              selected={sortBy === opt.id}
              onClick={() => setSortBy(opt.id)}
              className="w-full min-w-0 px-2 py-2 text-[11px] leading-tight min-[360px]:px-3 min-[360px]:text-[12px] sm:text-[13px]"
            />
          ))}
        </div>
      </div>

      <p className="text-[12px] font-semibold leading-relaxed text-muted">
        These filters affect what you see in this session only. Your dealbreakers always apply.
      </p>

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
