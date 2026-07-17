'use client';

import { cn } from '@/utils/cn';
import { IoClose, IoCompass } from 'react-icons/io5';

type Props = {
  name: string;
  onClear: () => void;
  className?: string;
};

export function MeetTypeDiscoverPill({ name, onClear, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-primary/20 bg-[#EDE8FF]/50 px-3 py-2',
        className
      )}
    >
      <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-[13px] font-extrabold text-primary">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full linkup-gradient-primary text-white shadow-sm">
          <IoCompass size={14} aria-hidden />
        </span>
        <span className="truncate">
          Viewing <span className="text-foreground">{name}</span> meetups on Discover
        </span>
      </span>
      <button
        type="button"
        onClick={onClear}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-white text-muted transition hover:border-primary/30 hover:text-primary"
        aria-label={`Clear ${name} filter`}
      >
        <IoClose size={16} />
      </button>
    </div>
  );
}
