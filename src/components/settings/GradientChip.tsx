'use client';

import { cn } from '@/utils/cn';

type Props = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

export function GradientChip({ label, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-[13px] font-extrabold transition',
        selected ? 'linkup-gradient-primary text-white shadow-sm' : 'border border-border bg-white text-primary hover:border-primary/30'
      )}
    >
      {label}
    </button>
  );
}
