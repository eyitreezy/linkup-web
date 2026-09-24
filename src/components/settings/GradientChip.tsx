'use client';

import { cn } from '@/utils/cn';

type Props = {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
};

export function GradientChip({ label, selected, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'box-border rounded-full border-2 px-4 py-2 text-[13px] font-extrabold transition-[background-color,border-color,color]',
        selected
          ? 'border-transparent linkup-gradient-primary text-white'
          : 'border-border bg-white text-primary hover:border-primary/30',
        className
      )}
    >
      {label}
    </button>
  );
}
