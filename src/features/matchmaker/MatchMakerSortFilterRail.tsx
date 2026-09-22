'use client';

import { MatchMakerFilterPanel } from '@/features/matchmaker/MatchMakerFilterPanel';
import { useMatchMakerPageOptional } from '@/features/matchmaker/MatchMakerPageContext';

/** Distance + sort filters in the desktop MatchMaker right rail. */
export function MatchMakerSortFilterRail() {
  const ctx = useMatchMakerPageOptional();

  if (!ctx) {
    return (
      <div className="linkup-card space-y-3 p-4 text-[13px] font-semibold leading-relaxed text-muted">
        <p className="font-extrabold text-foreground">Intentional matching</p>
        <p>
          Refine who appears in your pool. Distance and sort apply for this session only — your
          dealbreakers always run first.
        </p>
      </div>
    );
  }

  if (ctx.profileLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#FBF5F0]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#FBF5F0]/80" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-semibold leading-relaxed text-muted">
        Refine your pool for this session. Dealbreakers from your values setup always apply before
        these filters.
      </p>
      <MatchMakerFilterPanel
        embedded
        filter={ctx.filter}
        baseRadiusKm={ctx.baseRadiusKm}
        sliderMaxKm={ctx.sliderMaxKm}
        effectiveTier={ctx.effectiveTier}
        onApply={ctx.applyFilter}
      />
    </div>
  );
}
