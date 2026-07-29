'use client';

import { cn } from '@/utils/cn';

type Props = {
  score: number | null | undefined;
  count?: number | null;
  completedMeetupCount?: number | null;
  size?: 'sm' | 'md';
  className?: string;
};

export function HostRatingBadge({
  score,
  count,
  completedMeetupCount,
  size = 'sm',
  className,
}: Props) {
  const meetsThreshold = (completedMeetupCount ?? 0) >= 3;

  if (meetsThreshold && score != null && score > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span className="text-amber-500" aria-hidden>
          ★
        </span>
        <span
          className={cn(
            'font-extrabold text-foreground',
            size === 'sm' ? 'text-[11px]' : 'text-[13px]'
          )}
        >
          {score.toFixed(1)}
        </span>
        {count != null ? (
          <span
            className={cn(
              'font-semibold text-muted',
              size === 'sm' ? 'text-[10px]' : 'text-[12px]'
            )}
          >
            ({count})
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'font-semibold text-muted',
        size === 'sm' ? 'text-[10px]' : 'text-[12px]',
        className
      )}
    >
      New to LinkUp
    </span>
  );
}

export function StarRatingDisplay({
  score,
  max = 5,
  className,
}: {
  score: number;
  max?: number;
  className?: string;
}) {
  const rounded = Math.max(0, Math.min(max, Math.round(score)));
  return (
    <span className={cn('text-amber-500', className)} aria-label={`${score} out of ${max} stars`}>
      {'★'.repeat(rounded)}
      {'☆'.repeat(max - rounded)}
    </span>
  );
}
