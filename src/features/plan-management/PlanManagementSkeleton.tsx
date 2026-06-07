'use client';

import '@/features/plan-management/plan-management.css';
import { Skeleton } from '@/components/ui/Skeleton';
import { pmShell, pmShellPb } from '@/features/plan-management/planManagementLayout';
import { cn } from '@/utils/cn';

/** Plan management page skeleton — matches layout to prevent shift after auth resolves. */
export function PlanManagementSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(pmShell, pmShellPb, className)}
      role="status"
      aria-busy="true"
      aria-label="Loading plan management"
    >
      <div className="flex w-full min-w-0 items-center gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl min-[425px]:h-[52px] min-[425px]:w-[52px] min-[425px]:rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24 max-w-[40%]" />
          <Skeleton className="h-7 w-44 max-w-[85%]" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-36 w-full rounded-2xl min-[425px]:h-32 min-[425px]:rounded-3xl" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="w-full min-w-0">
        <Skeleton className="mb-2 h-3 w-16" />
        <div className="pm-chip-row flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-[4.25rem] shrink-0 grow-0 rounded-full" />
          ))}
        </div>
      </div>
      <ul className="pm-plan-list">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="w-full min-w-0">
            <Skeleton className="h-32 w-full rounded-2xl" />
          </li>
        ))}
      </ul>
    </div>
  );
}
