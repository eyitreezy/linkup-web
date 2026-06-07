'use client';

import { cn } from '@/utils/cn';

type Props = {
  count: number;
  /** Dot on nav icons (mobile tab bar style). */
  variant?: 'dot' | 'pill';
  className?: string;
  /** Ring matches parent background when tab is active. */
  ringClassName?: string;
  /** Accessible label for pill variant (dots are decorative). */
  ariaLabel?: string;
};

export function NotificationBadge({
  count,
  variant = 'pill',
  className,
  ringClassName = 'ring-white',
  ariaLabel,
}: Props) {
  if (count <= 0) return null;

  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-secondary ring-2',
          ringClassName,
          className
        )}
        aria-hidden
      />
    );
  }

  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-extrabold leading-none text-white shadow-sm',
        className
      )}
      aria-label={ariaLabel ?? `${label} unread`}
    >
      {label}
    </span>
  );
}
