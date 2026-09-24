'use client';

import { cn } from '@/utils/cn';
import { IoGridOutline, IoListOutline } from 'react-icons/io5';

export type ListGridViewMode = 'list' | 'grid';

type Props = {
  view: ListGridViewMode;
  onViewChange: (view: ListGridViewMode) => void;
  className?: string;
};

export function ListGridViewToggle({ view, onViewChange, className }: Props) {
  return (
    <div
      className={cn(
        'flex shrink-0 rounded-2xl border border-border/90 bg-white p-0.5 text-[11px] font-extrabold shadow-sm',
        className
      )}
      role="group"
      aria-label="Feed layout"
    >
      <button
        type="button"
        onClick={() => onViewChange('list')}
        aria-pressed={view === 'list'}
        aria-label="List view"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-[14px] transition',
          view === 'list' ? 'linkup-gradient-primary text-white shadow-sm' : 'text-muted hover:text-foreground'
        )}
      >
        <IoListOutline size={18} />
      </button>
      <button
        type="button"
        onClick={() => onViewChange('grid')}
        aria-pressed={view === 'grid'}
        aria-label="Grid view"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-[14px] transition',
          view === 'grid' ? 'linkup-gradient-primary text-white shadow-sm' : 'text-muted hover:text-foreground'
        )}
      >
        <IoGridOutline size={18} />
      </button>
    </div>
  );
}
