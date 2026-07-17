'use client';

import type { EscrowTimelineItem } from '@/lib/escrow/buildEscrowTimeline';
import { cn } from '@/utils/cn';
import { IoAlert, IoCheckmark } from 'react-icons/io5';

function toneColor(tone: EscrowTimelineItem['tone']) {
  switch (tone) {
    case 'done':
      return 'border-emerald-500 bg-emerald-50 text-emerald-700';
    case 'current':
      return 'border-primary bg-primary/5 text-primary';
    case 'warn':
      return 'border-red-400 bg-red-50 text-red-600';
    default:
      return 'border-[#D8DCE6] bg-white text-muted';
  }
}

type Props = {
  items: EscrowTimelineItem[];
  className?: string;
};

export function EscrowTimeline({ items, className }: Props) {
  return (
    <section className={cn('linkup-card overflow-hidden p-5 sm:p-6', className)}>
      <div className="mb-4 h-[3px] rounded-full bg-gradient-to-r from-primary/25 to-transparent" />
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Activity</p>
      <h3 className="mt-1 text-[17px] font-extrabold tracking-tight text-foreground">Escrow timeline</h3>
      <div className="mt-4 space-y-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <div key={item.key + String(i)} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-xl border-2',
                    toneColor(item.tone)
                  )}
                >
                  {item.tone === 'done' ? (
                    <IoCheckmark size={14} />
                  ) : item.tone === 'warn' ? (
                    <IoAlert size={14} />
                  ) : item.tone === 'current' ? (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[#D8DCE6]" />
                  )}
                </span>
                {!isLast ? (
                  <span
                    className={cn(
                      'my-1 w-0.5 flex-1 min-h-4',
                      item.tone === 'done' ? 'bg-emerald-300/50' : 'bg-[#D8DCE6]'
                    )}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <p
                  className={cn(
                    'text-[15px] font-extrabold text-foreground',
                    item.tone === 'current' && 'text-primary'
                  )}
                >
                  {item.title}
                </p>
                {item.subtitle ? (
                  <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">{item.subtitle}</p>
                ) : null}
                {item.at ? (
                  <p className="mt-1.5 text-[12px] font-semibold text-muted">
                    {new Date(item.at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
