'use client';

import { DiscoverFilterPanel } from '@/features/discover/DiscoverFilterPanel';
import { useDiscoverPageOptional } from '@/features/discover/DiscoverPageContext';

/** Filters + tips in the desktop Discover filter right rail. */
export function DiscoverForYouRail() {
  const ctx = useDiscoverPageOptional();

  if (!ctx) {
    return (
      <div className="linkup-card space-y-3 p-4 text-[13px] font-semibold leading-relaxed text-muted">
        <p className="font-extrabold text-foreground">Trust-first discovery</p>
        <p>Verified hosts, mood filters, and escrow-backed plans follow the same rules as the LinkUp app.</p>
      </div>
    );
  }

  if (ctx.profileLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/60" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-semibold leading-relaxed text-muted">
        Refine what shows in your feed. Your filter choices are saved to your profile, just like on the
        LinkUp app.
      </p>
      <DiscoverFilterPanel
        embedded
        filter={ctx.filter}
        mood={ctx.mood}
        baseRadiusKm={ctx.baseRadiusKm}
        sliderMaxKm={ctx.sliderMaxKm}
        effectiveTier={ctx.effectiveTier}
        advancedFiltersAllowed={ctx.advancedFiltersAllowed}
        onApply={ctx.applyFilters}
      />
    </div>
  );
}
