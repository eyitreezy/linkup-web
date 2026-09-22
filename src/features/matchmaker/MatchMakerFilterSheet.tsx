'use client';

import { MatchMakerFilterPanel } from '@/features/matchmaker/MatchMakerFilterPanel';
import type { MatchMakerFilterState } from '@/lib/matchmaker/filterState';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { useEffect } from 'react';
import { IoClose } from 'react-icons/io5';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: MatchMakerFilterState;
  baseRadiusKm: number;
  sliderMaxKm: number;
  effectiveTier: SubscriptionTier;
  onApply: (next: MatchMakerFilterState) => void;
};

/** Mobile-only bottom sheet — desktop uses the right Sort and filter rail. */
export function MatchMakerFilterSheet({
  open,
  onOpenChange,
  filter,
  baseRadiusKm,
  sliderMaxKm,
  effectiveTier,
  onApply,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] xl:hidden"
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
        className="relative flex h-[min(88dvh,640px)] w-full max-h-[min(88dvh,640px)] flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 px-4 py-3">
          <p className="font-display text-lg font-extrabold text-foreground">Sort & filter</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-border p-2 text-muted hover:bg-[#EDE8FF]/50"
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 min-[360px]:px-4">
          <MatchMakerFilterPanel
            sheet
            filter={filter}
            baseRadiusKm={baseRadiusKm}
            sliderMaxKm={sliderMaxKm}
            effectiveTier={effectiveTier}
            onApply={onApply}
            onApplied={() => onOpenChange(false)}
          />
        </div>
      </div>
    </div>
  );
}
