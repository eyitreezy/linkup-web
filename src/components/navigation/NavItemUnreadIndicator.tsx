'use client';

import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  count: number;
  showDot?: boolean;
  badgeVariant?: 'dot' | 'pill';
  active?: boolean;
  className?: string;
  ringClassName?: string;
};

export function NavItemUnreadIndicator({
  children,
  count,
  showDot = true,
  badgeVariant,
  active,
  className,
  ringClassName,
}: Props) {
  if (count <= 0) {
    return <>{children}</>;
  }

  const variant = badgeVariant ?? (showDot ? 'dot' : 'pill');

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {children}
      <NotificationBadge
        count={count}
        variant={variant}
        ringClassName={ringClassName ?? (active ? 'ring-primary' : 'ring-surface')}
        className={variant === 'pill' ? 'absolute -right-2 -top-2 min-w-[18px] px-1 py-0.5 text-[10px]' : undefined}
      />
    </span>
  );
}
