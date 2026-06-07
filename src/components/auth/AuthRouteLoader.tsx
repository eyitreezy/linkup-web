'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';

type Props = {
  variant?: 'shell' | 'redirect' | 'inline';
  className?: string;
};

/** Branded loader while Supabase session restores — never show sign-in copy during this phase. */
export function AuthRouteLoader({ variant = 'shell', className }: Props) {
  if (variant === 'redirect') {
    return (
      <div
        className={cn(
          'linkup-gradient-discovery flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6',
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" />
        <p className="text-[14px] font-semibold text-muted">Opening your workspace…</p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('w-full min-w-0 space-y-4', className)} role="status" aria-busy="true">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-40 max-w-full" />
          </div>
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'linkup-gradient-discovery flex h-full min-h-0 overflow-hidden',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <div className="flex h-full flex-col gap-4 p-4">
          <Skeleton className="h-10 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-hidden px-4 py-6 max-[424px]:px-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-48 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </main>
      </div>
    </div>
  );
}
