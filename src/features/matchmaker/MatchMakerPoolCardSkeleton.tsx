'use client';

import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';
import type { ListGridViewMode } from '@/components/feed/ListGridViewToggle';

export function MatchMakerPoolCardSkeleton({ view }: { view: ListGridViewMode }) {
  if (view === 'grid') {
    return (
      <div
        className="overflow-hidden rounded-[18px] border min-[360px]:rounded-[22px]"
        style={{ borderColor: MATCHMAKER_THEME.border }}
      >
        <div className="h-36 animate-pulse min-[360px]:h-44" style={{ background: MATCHMAKER_THEME.surfaceWarm }} />
        <div className="space-y-3 p-4">
          <div className="h-5 w-3/4 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
          <div className="h-4 w-1/2 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="h-10 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
            <div className="h-10 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border sm:flex-row"
      style={{ borderColor: MATCHMAKER_THEME.border }}
    >
      <div
        className="aspect-[16/10] w-full animate-pulse sm:w-[38%] sm:max-w-[220px] sm:min-h-[128px] sm:aspect-auto"
        style={{ background: MATCHMAKER_THEME.surfaceWarm }}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
        <div className="h-4 w-1/2 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="h-10 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
          <div className="h-10 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
        </div>
      </div>
    </div>
  );
}

export function MatchMakerPoolFeedSkeleton({
  view,
  count = 4,
  className,
}: {
  view: ListGridViewMode;
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        view === 'grid'
          ? 'grid grid-cols-1 gap-3 min-[400px]:gap-5 sm:grid-cols-2'
          : 'flex w-full min-w-0 max-w-full flex-col gap-3',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <MatchMakerPoolCardSkeleton key={i} view={view} />
      ))}
    </div>
  );
}
