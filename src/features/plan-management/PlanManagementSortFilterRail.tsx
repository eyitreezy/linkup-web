'use client';

import { SectionFilterChip, SortChip } from '@/features/plan-management/FilterChips';
import { usePlanManagementPageOptional } from '@/features/plan-management/PlanManagementPageContext';
import { pmSectionChipScroller, pmSortChipRow } from '@/features/plan-management/planManagementLayout';
import type { PlanManagementSection } from '@/lib/plans/planManagement';
import { cn } from '@/utils/cn';
import { IoFunnelOutline, IoSwapVertical } from 'react-icons/io5';

const SECTION_CHIPS: { id: PlanManagementSection; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'mood', label: 'Mood' },
  { id: 'expired', label: 'Expired' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'archived', label: 'Archived' },
];

/** Show + sort chips — inline on mobile; desktop right rail. */
export function PlanManagementSortFilterRail() {
  const ctx = usePlanManagementPageOptional();

  if (!ctx) {
    return (
      <p className="pm-body-text font-semibold text-muted">
        Open Plan management to filter and sort your meetups.
      </p>
    );
  }

  const { section, sort, sectionCounts, setSection, setSort } = ctx;

  return (
    <div className="pm-filter-block flex w-full min-w-0 max-w-full flex-col gap-4 min-[425px]:gap-5">
      <div className="min-w-0 max-w-full">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <IoFunnelOutline className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <span className="pm-rail-label text-foreground">Show</span>
        </div>
        <div className={cn(pmSectionChipScroller)} role="group" aria-label="Filter plans by section">
          {SECTION_CHIPS.map((c) => (
            <SectionFilterChip
              key={c.id}
              label={c.label}
              count={sectionCounts[c.id]}
              active={section === c.id}
              onClick={() => setSection(c.id)}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0 max-w-full">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <IoSwapVertical className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <span className="pm-rail-label text-foreground">Sort by</span>
        </div>
        <div className={cn(pmSortChipRow)} role="group" aria-label="Sort plans">
          <SortChip label="Newest" active={sort === 'newest'} onClick={() => setSort('newest')} />
          <SortChip label="Oldest" active={sort === 'oldest'} onClick={() => setSort('oldest')} />
          <SortChip label="Expiring" active={sort === 'expiring'} onClick={() => setSort('expiring')} />
        </div>
      </div>
    </div>
  );
}
