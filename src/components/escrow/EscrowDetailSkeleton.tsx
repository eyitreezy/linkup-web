'use client';

import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton for secure payment / escrow detail. Mirrors mobile escrow layout. */
export function EscrowDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-4 pb-[9.5rem] sm:space-y-5"
      role="status"
      aria-busy="true"
      aria-label="Loading secure payment"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-10 w-16 rounded-2xl" />
      </div>

      <div className="linkup-card flex gap-4 p-5">
        <Skeleton className="h-16 w-1 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>

      <div className="linkup-card space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>

      <Skeleton className="mx-auto h-11 w-full max-w-sm rounded-full" />

      <Skeleton className="h-6 w-28 rounded-full" />

      <div className="linkup-card p-4">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>

      <div className="linkup-card space-y-4 p-5">
        <Skeleton className="h-3 w-24" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-5 w-5 shrink-0 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
        ))}
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      <div className="linkup-card space-y-3 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
