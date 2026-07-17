import { Skeleton } from '@/components/ui/Skeleton';

/** Recent offers list while plan detail bundle refetches. */
export function PlanOffersListSkeleton() {
  return (
    <ul className="divide-y divide-border/50" aria-busy="true" aria-label="Loading offers">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
