'use client';

import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

/** MatchMaker screen entry — slides in from right per interaction spec. */
export function MatchMakerSlideIn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('matchmaker-slide-in-right min-h-full', className)}>{children}</div>;
}
