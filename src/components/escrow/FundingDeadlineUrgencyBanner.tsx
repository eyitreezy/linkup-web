'use client';

import { memo, useEffect, useState } from 'react';
import { IoAlertCircle, IoFlashOutline } from 'react-icons/io5';
import { cn } from '@/utils/cn';

function formatRemain(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

type Props = {
  deadlineIso: string;
  isMoodPlan: boolean;
  className?: string;
};

export const FundingDeadlineUrgencyBanner = memo(function FundingDeadlineUrgencyBanner({
  deadlineIso,
  isMoodPlan,
  className,
}: Props) {
  const [label, setLabel] = useState(() => formatRemain(new Date(deadlineIso).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setLabel(formatRemain(new Date(deadlineIso).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  const expired = new Date(deadlineIso).getTime() <= Date.now();

  if (expired) {
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4',
          className
        )}
        role="alert"
      >
        <IoAlertCircle size={22} className="shrink-0 text-red-600" />
        <p className="text-[14px] font-semibold leading-relaxed text-foreground">
          The funding window for this agreement has ended. If escrow wasn&apos;t completed, you may need
          to agree again or contact support.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        isMoodPlan
          ? 'border-orange-200/55 bg-[#DC4838]/90 text-white'
          : 'border-primary/30 bg-primary/10',
        className
      )}
      role="status"
    >
      <IoFlashOutline size={22} className={cn('shrink-0', isMoodPlan ? 'text-white' : 'text-primary')} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] font-extrabold', isMoodPlan ? 'text-white' : 'text-foreground')}>
          {isMoodPlan ? 'Mood plan: fund escrow soon' : 'Complete funding'}
        </p>
        <p className={cn('mt-1 text-[13px] font-semibold leading-relaxed', isMoodPlan ? 'text-white/90' : 'text-muted')}>
          <span className={cn('font-extrabold tabular-nums', isMoodPlan ? 'text-white' : 'text-primary')}>
            {label}
          </span>{' '}
          remaining to fund escrow on this screen. Automated push and email reminders run if notifications
          are on in Settings.
        </p>
      </div>
    </div>
  );
});
