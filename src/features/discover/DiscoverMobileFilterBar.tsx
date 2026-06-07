'use client';

import { DiscoverFilterPanel } from '@/features/discover/DiscoverFilterPanel';
import { isDiscoverFiltersActive } from '@/lib/discovery/discoverFilterSummary';
import type { FeedFilterState } from '@/lib/discovery/feedFilters';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { cn } from '@/utils/cn';
import { useEffect } from 'react';
import { IoClose, IoFunnel } from 'react-icons/io5';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: FeedFilterState;
  mood: DiscoveryMood;
  baseRadiusKm: number;
  isPremium: boolean;
  onApply: (filter: FeedFilterState, mood: DiscoveryMood) => void;
};

export function DiscoverFilterIconButton({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? 'Filters active — open to edit' : 'Open filters'}
      aria-haspopup="dialog"
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition active:scale-95',
        active
          ? 'border-primary/40 bg-gradient-to-br from-[#EDE8FF] via-white to-[#FFF5F8] shadow-[0_4px_18px_rgba(108,99,255,0.22)]'
          : 'border-border/90 bg-white shadow-[0_2px_10px_rgba(42,31,85,0.06)] hover:border-primary/30 hover:shadow-[0_4px_14px_rgba(108,99,255,0.12)]',
        className
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl',
          active ? 'linkup-gradient-primary text-white shadow-sm' : 'bg-[#EDE8FF]/80 text-primary'
        )}
      >
        <IoFunnel size={18} className={active ? 'text-white' : 'text-primary'} />
      </span>
      {active ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-secondary ring-2 ring-white"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export function DiscoverFilterSheet({
  open,
  onOpenChange,
  filter,
  mood,
  baseRadiusKm,
  isPremium,
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
      aria-label="Discover filters"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close filters"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="relative flex max-h-[min(88vh,640px)] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl"
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
          <DiscoverFilterPanel
            sheet
            filter={filter}
            mood={mood}
            baseRadiusKm={baseRadiusKm}
            isPremium={isPremium}
            onApply={onApply}
            onApplied={() => onOpenChange(false)}
          />
        </div>
      </div>
    </div>
  );
}

export function useDiscoverFilterActive(filter: FeedFilterState, mood: DiscoveryMood) {
  return isDiscoverFiltersActive(filter, mood);
}
