'use client';

import { cn } from '@/utils/cn';
import { IoFlash } from 'react-icons/io5';

type Props = {
  variant?: 'mini' | 'full';
  className?: string;
};

export function BoostPill({ variant = 'full', className }: Props) {
  if (variant === 'mini') {
    return (
      <span
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-full linkup-gradient-primary text-white shadow-sm',
          className
        )}
        title="Boosted in Discover"
      >
        <IoFlash size={14} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm linkup-gradient-primary',
        className
      )}
    >
      <IoFlash size={12} />
      Boosted
    </span>
  );
}
