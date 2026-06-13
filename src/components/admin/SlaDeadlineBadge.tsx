'use client';

import { cn } from '@/utils/cn';
import { IoTimeOutline } from 'react-icons/io5';

type Props = {
  deadline: string;
  className?: string;
};

/** SLA countdown pill — matches EscrowStatusBadge dimensions. */
export function SlaDeadlineBadge({ deadline, className }: Props) {
  const hoursRemaining = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  const isPast = hoursRemaining < 0;
  const isUrgent = !isPast && hoursRemaining < 6;
  const isWarning = !isPast && hoursRemaining < 12;

  const label = isPast
    ? 'Overdue'
    : hoursRemaining < 1
      ? '<1h left'
      : `${Math.round(hoursRemaining)}h left`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide',
        isPast
          ? 'bg-red-100 text-red-700'
          : isUrgent
            ? 'bg-red-50 text-red-600'
            : isWarning
              ? 'bg-amber-50 text-amber-800'
              : 'bg-muted/10 text-muted',
        className
      )}
    >
      <IoTimeOutline size={11} aria-hidden />
      {label}
    </span>
  );
}
