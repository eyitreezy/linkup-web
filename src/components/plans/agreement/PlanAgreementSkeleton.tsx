'use client';

import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton for Confirm plan / agreement. Mirrors PlanAgreementScreen layout. */
export function PlanAgreementSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6 pb-[9.5rem]"
      role="status"
      aria-busy="true"
      aria-label="Loading agreement"
    >
      <div className="space-y-4">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <header className="flex gap-4">
          <Skeleton className="mt-1 h-12 w-1 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-48 max-w-[85%]" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </header>
      </div>

      <div className="linkup-card flex flex-col items-center p-6">
        <div className="mb-4 flex items-center justify-center">
          <Skeleton className="-mr-4 h-[68px] w-[68px] rounded-full" />
          <Skeleton className="h-[68px] w-[68px] rounded-full" />
        </div>
        <Skeleton className="h-5 w-52 max-w-[80%]" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="flex flex-col items-center px-1">
        <Skeleton className="h-10 w-44 rounded-full" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      </div>

      <div className="linkup-card space-y-4 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-3/4 max-w-sm" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 border-t border-primary/10 py-4">
            <Skeleton className="h-6 w-6 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-full max-w-xs" />
            </div>
          </div>
        ))}
      </div>

      <div className="linkup-card space-y-3 p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-12 flex-1 rounded-full" />
        <Skeleton className="h-12 flex-1 rounded-full" />
      </div>
    </div>
  );
}
