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
        'box-border rounded-full border px-4 py-2 text-[13px] font-extrabold transition',
        selected
          ? 'border-primary/40 linkup-gradient-primary text-white shadow-sm'
          : 'border-border bg-white text-primary hover:border-primary/30'
      )}
    >
      {label}
    </button>
  );
}
