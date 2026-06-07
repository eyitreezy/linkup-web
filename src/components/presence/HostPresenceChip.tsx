'use client';

import { cn } from '@/utils/cn';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';

type Props = {
  presence: PresenceUi | null;
  variant?: 'onDark' | 'onLight';
  className?: string;
};

function dotColor(dot: NonNullable<PresenceUi['dot']>): string {
  if (dot === 'online') return 'bg-emerald-500';
  if (dot === 'recent') return 'bg-muted';
  return 'bg-slate-400';
}

export function HostPresenceChip({ presence, variant = 'onLight', className }: Props) {
  if (!presence?.caption) return null;
  const onDark = variant === 'onDark';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-wide',
        onDark ? 'border-white/30 bg-black/45 text-white' : 'border-primary/20 bg-primary/8 text-foreground',
        className
      )}
    >
      {presence.dot ? (
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor(presence.dot))} />
      ) : null}
      {presence.caption}
    </span>
  );
}
