'use client';

import { cn } from '@/utils/cn';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import { IoChevronForward } from 'react-icons/io5';

type Props = {
  href: string;
  icon: IconType;
  label: string;
  subtitle?: string;
  badgeCount?: number;
  danger?: boolean;
  isLast?: boolean;
};

export function ProfileSettingsRow({
  href,
  icon: Icon,
  label,
  subtitle,
  badgeCount,
  danger,
  isLast,
}: Props) {
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#EDE8FF]/45',
        !isLast && 'border-b border-border/80'
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2',
          danger ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-primary/20 bg-background'
        )}
      >
        <Icon size={20} className={danger ? 'text-[#EF4444]' : 'text-primary'} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('text-[15px] font-extrabold', danger ? 'text-[#EF4444]' : 'text-foreground')}>
            {label}
          </span>
          {showBadge ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-extrabold text-white">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-[13px] font-semibold capitalize text-muted">{subtitle}</span>
        ) : null}
      </span>
      <IoChevronForward size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
