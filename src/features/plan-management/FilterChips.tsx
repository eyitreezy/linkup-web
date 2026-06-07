'use client';

import { pmChipBase } from '@/features/plan-management/planManagementLayout';
import { cn } from '@/utils/cn';

type ChipProps = {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
};

export function SectionFilterChip({ label, active, count, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        pmChipBase,
        'inline-flex items-center gap-2',
        active
          ? 'linkup-gradient-primary text-white shadow-md'
          : 'border border-primary/15 bg-white/90 text-primary shadow-sm hover:border-primary/30'
      )}
    >
      {label}
      {count != null ? (
        <span
          className={cn(
            'pm-chip-count',
            active ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function SortChip({ label, active, onClick }: Omit<ChipProps, 'count'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        pmChipBase,
        active
          ? 'linkup-gradient-primary text-white shadow-md'
          : 'border border-primary/12 bg-white/90 text-muted shadow-sm hover:border-primary/25 hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}
