import { ActionButtonsSkeleton } from '@/components/plans/ActionButtonsSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

/** Meetup details route skeleton — hero, meta, action pills, offers list. */
export function PlanDetailPageSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6 pb-16"
      role="status"
      aria-busy="true"
      aria-label="Loading meetup details"
    >
      <div className="space-y-4">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <header className="flex gap-4">
          <Skeleton className="mt-1 h-12 w-1 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-52 max-w-[85%]" />
            <Skeleton className="h-4 w-40" />
          </div>
        </header>
      </div>

      <Skeleton className="h-52 w-full rounded-2xl md:h-60" />

      <div className="linkup-card space-y-4 p-5">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>

      <Skeleton className="h-24 w-full rounded-2xl" />

      <ActionButtonsSkeleton />

      <div className="linkup-card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
        <div className="space-y-0 divide-y divide-border/50 px-5 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
