import { escrowStatusLabel } from '@/lib/escrow/escrowFormatters';
import type { EscrowStatus } from '@/types/database';
import { cn } from '@/utils/cn';

const STATUS_CLASS: Record<string, string> = {
  pending_funding: 'bg-amber-100 text-amber-800',
  funded: 'bg-emerald-100 text-emerald-800',
  active: 'bg-emerald-100 text-emerald-800',
  released: 'bg-slate-100 text-slate-600',
  disputed: 'bg-red-100 text-red-800',
  refunded: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function EscrowStatusBadge({
  status,
  label,
}: {
  status: EscrowStatus | string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border border-transparent px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide',
        STATUS_CLASS[status] ?? 'bg-muted/10 text-muted'
      )}
    >
      {label ?? escrowStatusLabel(status)}
    </span>
  );
}
