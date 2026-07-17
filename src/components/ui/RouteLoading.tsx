import { PlanCardSkeleton, Skeleton } from '@/components/ui/Skeleton';

type Variant = 'feed' | 'grid' | 'inbox' | 'form' | 'generic';

export function RouteLoading({
  variant = 'generic',
  label = 'Loading…',
}: {
  variant?: Variant;
  label?: string;
}) {
  return (
    <div className="animate-pulse space-y-6 pb-10" aria-busy="true" aria-label={label}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-44" />
        </div>
      </div>

      {variant === 'feed' ? (
        <>
          <Skeleton className="h-10 w-full max-w-md rounded-full" />
          <div className="grid gap-5 sm:grid-cols-2">
            <PlanCardSkeleton />
            <PlanCardSkeleton />
          </div>
        </>
      ) : null}

      {variant === 'grid' ? (
        <div className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[640px]:gap-3 min-[1024px]:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-[20px]" />
          ))}
        </div>
      ) : null}

      {variant === 'inbox' ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-[22px]" />
          ))}
        </div>
      ) : null}

      {variant === 'form' ? (
        <>
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </>
      ) : null}

      {variant === 'generic' ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}
    </div>
  );
}
