'use client';

import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type Props = {
  active: boolean;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function MoodLiveBorder({ active, children, className, innerClassName }: Props) {
  return (
    <div
      className={cn(
        'rounded-[22px] p-[2px]',
        active ? 'mood-live-border-animated' : 'border-2 border-violet-300/55',
        className
      )}
    >
      <div className={cn('overflow-hidden rounded-[20px] bg-white', innerClassName)}>{children}</div>
    </div>
  );
}
