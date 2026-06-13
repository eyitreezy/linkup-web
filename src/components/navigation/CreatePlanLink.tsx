'use client';

import { CREATE_PLAN_PATH } from '@/lib/navigation/createPlan';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type MouseEvent, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
};

/** Reliable entry to the create-plan form (explicit client nav + tap target). */
export function CreatePlanLink({ children, className, 'aria-label': ariaLabel }: Props) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const onNavigate = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (navigating) return;
      setNavigating(true);
      router.push(CREATE_PLAN_PATH);
    },
    [navigating, router]
  );

  return (
    <Link
      href={CREATE_PLAN_PATH}
      prefetch
      aria-label={ariaLabel}
      aria-busy={navigating || undefined}
      onClick={onNavigate}
      className={cn(
        'relative z-10 touch-manipulation',
        navigating && 'pointer-events-none opacity-90',
        className
      )}
    >
      {children}
    </Link>
  );
}
