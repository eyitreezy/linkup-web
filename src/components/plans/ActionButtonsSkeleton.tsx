import { Skeleton } from '@/components/ui/Skeleton';

/** Plan detail action rows while offer context loads. */
export function ActionButtonsSkeleton() {
  return (
    <div className="space-y-3 pb-2">
      <div className={planActionGrid}>
        <Skeleton className="h-[52px] w-full rounded-full" />
        <Skeleton className="h-[52px] w-full rounded-full" />
      </div>
      <div className={planActionGrid}>
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}

const planActionGrid =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-3 px-0';
