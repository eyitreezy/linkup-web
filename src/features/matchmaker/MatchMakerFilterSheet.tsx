'use client';

import { GradientChip } from '@/components/settings/GradientChip';
import {
  defaultMatchMakerFilter,
  isMatchMakerFilterActive,
  type MatchMakerFilterState,
  type MatchMakerSortBy,
} from '@/lib/matchmaker/filterState';
import { clampMaxDistanceKm, sliderMaxKmForTier } from '@/lib/plans/discoveryRadius';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: MatchMakerFilterState;
  baseRadiusKm: number;
  effectiveTier: SubscriptionTier;
  onApply: (next: MatchMakerFilterState) => void;
};

export function MatchMakerFilterSheet({
  open,
  onOpenChange,
  filter,
  baseRadiusKm,
  effectiveTier,
  onApply,
}: Props) {
  const sliderMax = sliderMaxKmForTier(effectiveTier);
  const [maxKm, setMaxKm] = useState<number | null>(filter.maxDistanceKm);
  const [sortBy, setSortBy] = useState<MatchMakerSortBy>(filter.sortBy);

  useEffect(() => {
    if (open) {
      setMaxKm(filter.maxDistanceKm);
      setSortBy(filter.sortBy);
    }
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  function handleApply() {
    const appliedMaxKm = maxKm != null ? clampMaxDistanceKm(maxKm, effectiveTier) : null;
    const next: MatchMakerFilterState = {
      maxDistanceKm: appliedMaxKm,
      sortBy,
      filterActive: isMatchMakerFilterActive({ maxDistanceKm: appliedMaxKm, sortBy }),
    };
    onApply(next);
    onOpenChange(false);
  }

  function handleClear() {
    onApply(defaultMatchMakerFilter());
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Filter MatchMaker"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close filters"
        onClick={() => onOpenChange(false)}
      />

      <div
        className="relative flex w-full max-h-[min(92dvh,640px)] flex-col overflow-hidden rounded-t-3xl border border-border bg-white shadow-2xl"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h2 className="font-display text-[17px] font-extrabold text-foreground">Filter MatchMaker</h2>
          <button
            type="button"
            onClick={handleClear}
            className="text-[13px] font-extrabold text-primary transition hover:opacity-70"
          >
            Clear filters
          </button>
        </div>

        <div
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5"
          style={{ maxHeight: 'calc(92dvh - 140px)' }}
        >
          <section>
            <h3 className="mb-3 font-display text-[15px] font-extrabold text-foreground">Distance</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-muted">
                  {maxKm == null ? 'No distance limit' : `Up to ${maxKm} km away`}
                </span>
                {maxKm != null ? (
                  <button
                    type="button"
                    onClick={() => setMaxKm(null)}
                    className="text-[12px] font-extrabold text-primary"
                  >
                    Remove cap
                  </button>
                ) : null}
              </div>
              <input
                type="range"
                min={1}
                max={sliderMax}
                step={1}
                value={maxKm ?? sliderMax}
                onChange={(e) => setMaxKm(Number(e.target.value))}
                className="h-2 w-full rounded-full accent-primary"
              />
              <div className="flex justify-between text-[11px] font-semibold text-muted">
                <span>1 km</span>
                <span>{sliderMax} km</span>
              </div>
              <p className="text-[11px] font-semibold text-muted">
                Requires location to be set on your profile. Default browse radius: {baseRadiusKm} km.
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-display text-[15px] font-extrabold text-foreground">Sort by</h3>
            <div className="flex flex-wrap gap-2">
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
                />
              ))}
            </div>
          </section>

          <p className="text-[12px] font-semibold leading-relaxed text-muted">
            These filters affect what you see in this session only. Your dealbreakers always apply.
          </p>
        </div>

        <div className="shrink-0 border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={handleApply}
            className="w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
