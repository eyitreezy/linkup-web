'use client';

import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

type Props = {
  expiresAtIso: string;
  className?: string;
  tone?: 'brand' | 'onDark';
};

export function MoodPlanCountdown({ expiresAtIso, className, tone = 'brand' }: Props) {
  const [label, setLabel] = useState(() =>
    formatRemaining(new Date(expiresAtIso).getTime() - Date.now())
  );

  useEffect(() => {
    const tick = () => setLabel(formatRemaining(new Date(expiresAtIso).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  return (
    <span
      className={cn(
        'text-[12px] font-extrabold tabular-nums',
        tone === 'onDark' ? 'text-white/95' : 'text-secondary',
        className
      )}
    >
      {label}
    </span>
  );
}
