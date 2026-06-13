'use client';

import { getMonthResetLabel } from '@/lib/subscription/boostQuota';
import { cn } from '@/utils/cn';

type Props = {
  total: number;
  used: number;
  unlimited?: boolean;
  unlimitedLabel?: string;
  className?: string;
};

export function QuotaPipRow({
  total,
  used,
  unlimited,
  unlimitedLabel = 'Unlimited',
  className,
}: Props) {
  if (unlimited) {
    return (
      <p className={cn('text-center text-[11px] font-semibold text-muted', className)}>
        {unlimitedLabel}
      </p>
    );
  }

  if (total <= 0) return null;

  const remaining = Math.max(0, total - used);
  const label =
    remaining <= 0
      ? `Resets ${getMonthResetLabel()}`
      : `${remaining} left · resets ${getMonthResetLabel()}`;

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <div className="flex flex-wrap justify-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn('h-1.5 w-1.5 rounded-full', i < used ? 'bg-border' : 'bg-primary')}
            aria-hidden
          />
        ))}
      </div>
      <p className="text-center text-[11px] font-semibold text-muted">{label}</p>
    </div>
  );
}
