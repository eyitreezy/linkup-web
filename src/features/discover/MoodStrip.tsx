'use client';

import { cn } from '@/utils/cn';

const MOODS = [
  { id: 'chill', label: 'Chill' },
  { id: 'active', label: 'Active' },
  { id: 'social', label: 'Social' },
  { id: 'premium', label: 'Premium' },
] as const;

type Props = {
  active?: string;
  onSelect: (mood: string | undefined) => void;
};

export function MoodStrip({ active, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          'shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold transition',
          !active
            ? 'linkup-gradient-primary text-white shadow-md'
            : 'bg-surface text-muted border border-border'
        )}
      >
        All
      </button>
      {MOODS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m.id)}
          className={cn(
            'shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold transition',
            active === m.id
              ? 'linkup-gradient-primary text-white shadow-md'
              : 'bg-surface text-muted border border-border'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
