'use client';

import { cn } from '@/utils/cn';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';

type Props = {
  uri: string | null | undefined;
  name: string;
  size?: number;
  presence: PresenceUi | null;
  showDot?: boolean;
  className?: string;
};

function dotColor(dot: NonNullable<PresenceUi['dot']>): string {
  if (dot === 'online') return 'bg-emerald-500';
  if (dot === 'recent') return 'bg-muted';
  return 'bg-slate-400';
}

function ringColor(dot: NonNullable<PresenceUi['dot']>): string {
  if (dot === 'online') return 'ring-emerald-500/35';
  if (dot === 'recent') return 'ring-muted/35';
  return 'ring-slate-400/40';
}

export function AvatarWithPresence({
  uri,
  name,
  size = 48,
  presence,
  showDot = true,
  className,
}: Props) {
  const initial = name.charAt(0).toUpperCase();
  const dot = showDot && presence?.dot;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={uri}
          alt=""
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          {initial}
        </span>
      )}
      {dot ? (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-surface ring-2',
            ringColor(dot),
            'bottom-0 right-0'
          )}
          style={{
            width: size * 0.28,
            height: size * 0.28,
          }}
          aria-label={presence?.caption ?? 'Presence'}
        >
          <span
            className={cn('rounded-full', dotColor(dot))}
            style={{
              width: size * 0.16,
              height: size * 0.16,
            }}
          />
        </span>
      ) : null}
    </span>
  );
}
