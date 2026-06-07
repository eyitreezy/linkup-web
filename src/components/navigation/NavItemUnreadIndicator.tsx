'use client';

import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  count: number;
  showDot?: boolean;
  active?: boolean;
  className?: string;
  ringClassName?: string;
};

export function NavItemUnreadIndicator({
  children,
  count,
  showDot = true,
  active,
  className,
  ringClassName,
}: Props) {
  if (!showDot || count <= 0) {
    return <>{children}</>;
  }

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {children}
      <NotificationBadge
        count={count}
        variant="dot"
        ringClassName={ringClassName ?? (active ? 'ring-primary' : 'ring-surface')}
      />
    </span>
  );
}
