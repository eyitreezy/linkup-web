import type { JoinRequestStatus } from '@/types/database';
import { cn } from '@/utils/cn';

const STATUS_CONFIG: Record<
  JoinRequestStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-amber-500/12 text-amber-800' },
  approved: { label: 'Approved', className: 'bg-emerald-500/12 text-emerald-700' },
  declined: { label: 'Declined', className: 'bg-red-500/12 text-red-700' },
};

type Props = {
  status: JoinRequestStatus;
};

export function JoinRequestStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-extrabold', config.className)}>
      {config.label}
    </span>
  );
}
