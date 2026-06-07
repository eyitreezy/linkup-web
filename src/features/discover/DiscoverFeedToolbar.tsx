'use client';

import {
  DiscoverFilterIconButton,
  DiscoverFilterSheet,
  useDiscoverFilterActive,
} from '@/features/discover/DiscoverMobileFilterBar';
import type { FeedFilterState } from '@/lib/discovery/feedFilters';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import { IoAlbumsOutline, IoGridOutline, IoListOutline } from 'react-icons/io5';

export type DiscoverViewMode = 'swipe' | 'grid' | 'list';

type Props = {
  planCount: number;
  moodCount: number;
  filtersActive: boolean;
  filter: FeedFilterState;
  mood: DiscoveryMood;
  baseRadiusKm: number;
  isPremium: boolean;
  profileLoading?: boolean;
  onApply: (filter: FeedFilterState, mood: DiscoveryMood) => void;
  view: DiscoverViewMode;
  onViewChange: (view: DiscoverViewMode) => void;
  /** Mobile: swipe + grid. Desktop: list + grid. */
  isMobileLayout: boolean;
};

export function DiscoverFeedToolbar({
  planCount,
  moodCount,
  filtersActive,
  filter,
  mood,
  baseRadiusKm,
  isPremium,
  profileLoading,
  onApply,
  view,
  onViewChange,
  isMobileLayout,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterActive = useDiscoverFilterActive(filter, mood) || filtersActive;

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-muted min-[360px]:text-[11px] sm:text-[12px]">
          {planCount} plan{planCount === 1 ? '' : 's'}
          {filtersActive ? ' · filtered' : ''}
          {moodCount > 0 ? ` · ${moodCount} mood` : ''}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {profileLoading ? (
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-[#EDE8FF]/80 xl:hidden" aria-hidden />
          ) : (
            <div className="xl:hidden">
              <DiscoverFilterIconButton active={filterActive} onClick={() => setFilterOpen(true)} />
            </div>
          )}

          <div
            className="flex shrink-0 rounded-2xl border border-border/90 bg-white p-0.5 text-[11px] font-extrabold shadow-sm"
            role="group"
            aria-label="Feed layout"
          >
            {isMobileLayout ? (
              <button
                type="button"
                onClick={() => onViewChange('swipe')}
                aria-pressed={view === 'swipe'}
                aria-label="Swipe view"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-[14px] transition',
                  view === 'swipe' ? 'linkup-gradient-primary text-white shadow-sm' : 'text-muted hover:text-foreground'
                )}
              >
                <IoAlbumsOutline size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onViewChange('list')}
                aria-pressed={view === 'list'}
                aria-label="List view"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-[14px] transition',
                  view === 'list' ? 'linkup-gradient-primary text-white shadow-sm' : 'text-muted hover:text-foreground'
                )}
              >
                <IoListOutline size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onViewChange('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[14px] transition',
                view === 'grid' ? 'linkup-gradient-primary text-white shadow-sm' : 'text-muted hover:text-foreground'
              )}
            >
              <IoGridOutline size={18} />
            </button>
          </div>
        </div>
      </div>

      <DiscoverFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filter={filter}
        mood={mood}
        baseRadiusKm={baseRadiusKm}
        isPremium={isPremium}
        onApply={onApply}
      />
    </>
  );
}
