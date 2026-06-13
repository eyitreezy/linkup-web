'use client';

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'platinum';

const TONE: Record<
  Tone,
  { wrap: string; stripe: string; title: string; body: string }
> = {
  success: {
    wrap: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white',
    stripe: 'bg-emerald-500',
    title: 'text-emerald-900',
    body: 'text-emerald-800',
  },
  info: {
    wrap: 'border-primary/20 bg-gradient-to-br from-[#EDE8FF]/70 to-white',
    stripe: 'bg-primary',
    title: 'text-foreground',
    body: 'text-muted',
  },
  warning: {
    wrap: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white',
    stripe: 'bg-amber-500',
    title: 'text-amber-900',
    body: 'text-amber-800',
  },
  danger: {
    wrap: 'border-red-200/80 bg-gradient-to-br from-red-50 to-white',
    stripe: 'bg-red-500',
    title: 'text-red-900',
    body: 'text-red-800',
  },
  neutral: {
    wrap: 'border-border bg-gradient-to-br from-[#F8F7FF] to-white',
    stripe: 'bg-slate-400',
    title: 'text-foreground',
    body: 'text-muted',
  },
  platinum: {
    wrap: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-white',
    stripe: 'bg-violet-500',
    title: 'text-violet-900',
    body: 'text-violet-800',
  },
};

type Props = {
  tone?: Tone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function EscrowNoticeBanner({
  tone = 'info',
  icon,
  title,
  children,
  footer,
  className,
}: Props) {
  const t = TONE[tone];
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-5 pl-6', t.wrap, className)}>
      <div className={cn('absolute bottom-3 left-0 top-3 w-1 rounded-full', t.stripe)} aria-hidden />
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn('text-[14px] font-extrabold', t.title)}>{title}</p>
          {children ? (
            <div className={cn('text-[13px] font-semibold leading-relaxed', t.body)}>{children}</div>
          ) : null}
          {footer ? <div className="pt-2">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
