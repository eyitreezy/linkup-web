import type { OfferStatus } from '@/types/database';
import { cn } from '@/utils/cn';

const STATUS_CONFIG: Record<OfferStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting response', className: 'bg-amber-500/12 text-amber-800' },
  countered: { label: 'Countered', className: 'bg-secondary/12 text-secondary' },
  countered_by_host: { label: 'Host countered', className: 'bg-primary/12 text-primary' },
  countered_by_guest: { label: 'Guest countered', className: 'bg-purple-500/12 text-purple-700' },
  accepted: { label: 'Accepted', className: 'bg-emerald-500/12 text-emerald-700' },
  declined: { label: 'Declined', className: 'bg-red-500/12 text-red-700' },
  withdrawn: { label: 'Withdrawn', className: 'bg-muted/15 text-muted' },
  superseded: { label: 'Superseded', className: 'bg-muted/15 text-muted' },
  expired: { label: 'Expired', className: 'bg-muted/20 text-muted' },
};

type Props = {
  status: OfferStatus;
  expired?: boolean;
};

export function OfferStatusBadge({ status, expired }: Props) {
  const config = expired && status === 'pending' ? STATUS_CONFIG.expired : STATUS_CONFIG[status];
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-extrabold', config.className)}>
      {config.label}
    </span>
  );
}
