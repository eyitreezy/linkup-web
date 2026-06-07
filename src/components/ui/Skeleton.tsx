import { cn } from '@/utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-[#EDE8FF]/80', className)} />;
}

export function PlanCardSkeleton() {
  return (
    <div className="linkup-card overflow-hidden p-0">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
