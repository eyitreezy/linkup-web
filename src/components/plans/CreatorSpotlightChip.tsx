'use client';

import { cn } from '@/utils/cn';
import { IoStar } from 'react-icons/io5';

type Props = {
  variant?: 'light' | 'onDark';
  className?: string;
};

/** Subtle creator spotlight — host metadata row, not the plan boost corner badge. */
export function CreatorSpotlightChip({ variant = 'light', className }: Props) {
  const onDark = variant === 'onDark';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
        onDark
          ? 'border-amber-200/40 bg-amber-400/25 text-amber-100'
          : 'border-amber-200/80 bg-amber-50 text-amber-800',
        className
      )}
    >
      <IoStar size={10} className={onDark ? 'text-amber-200' : 'text-amber-600'} aria-hidden />
      Featured
    </span>
  );
}
