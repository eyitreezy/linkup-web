'use client';

import { cn } from '@/utils/cn';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { IoSparkles } from 'react-icons/io5';

export type EmptyStateTip = {
  icon: IconType;
  text: string;
  /** Tailwind text color class, e.g. `text-primary` */
  iconClassName?: string;
  /** Tailwind background class for icon chip, e.g. `bg-primary/10` */
  iconBgClassName?: string;
};

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
};

type Props = {
  /** Ionicons node or custom icon inside the hero ring */
  icon?: ReactNode;
  /** Large emoji inside the ring (used when icon is omitted) */
  emoji?: string;
  title: string;
  /** Substring of title rendered in secondary brand color */
  titleAccent?: string;
  description: string;
  tips?: EmptyStateTip[];
  tipsLabel?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** `compact` for side panels (messages inbox); default for full pages */
  variant?: 'default' | 'compact';
  className?: string;
};

function renderTitle(title: string, accent?: string) {
  if (!accent || !title.includes(accent)) {
    return title;
  }
  const idx = title.indexOf(accent);
  const before = title.slice(0, idx);
  const after = title.slice(idx + accent.length);
  return (
    <>
      {before}
      <span className="text-secondary">{accent}</span>
      {after}
    </>
  );
}

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  const isPrimary = action.variant !== 'secondary';
  const className = cn(
    'inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-[14px] font-extrabold transition',
    isPrimary
      ? 'linkup-gradient-primary text-white shadow-md hover:opacity-95'
      : 'border border-primary/25 bg-white text-primary hover:bg-[#EDE8FF]/50'
  );

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

/** Standard LinkUp empty state — gradient hero ring, warm copy, optional tips & CTAs. */
export function AppEmptyState({
  icon,
  emoji,
  title,
  titleAccent,
  description,
  tips,
  tipsLabel = 'Easy wins',
  action,
  secondaryAction,
  variant = 'default',
  className,
}: Props) {
  const compact = variant === 'compact';

  return (
    <div
      className={cn(
        'linkup-card flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-10 md:px-8 md:py-12',
        className
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full p-[3px] linkup-gradient-primary shadow-[0_10px_28px_rgba(108,99,255,0.22)]',
          compact ? 'mb-4 h-[88px] w-[88px]' : 'mb-6 h-[118px] w-[118px]'
        )}
        aria-hidden
      >
        <div
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full border border-white/90 bg-gradient-to-br from-white to-[#F8F4FF]',
            compact ? 'text-[40px]' : 'text-[52px]'
          )}
        >
          {icon ?? (emoji ? <span aria-hidden>{emoji}</span> : <span aria-hidden>✨</span>)}
        </div>
      </div>

      <h2
        className={cn(
          'font-display font-extrabold tracking-tight text-foreground',
          compact ? 'text-lg' : 'text-xl md:text-2xl'
        )}
      >
        {renderTitle(title, titleAccent)}
      </h2>
      <p
        className={cn(
          'mt-2 max-w-md font-semibold leading-relaxed text-muted',
          compact ? 'text-[13px]' : 'text-[14px] md:text-[15px]'
        )}
      >
        {description}
      </p>

      {tips && tips.length > 0 ? (
        <div
          className={cn(
            'mt-6 w-full max-w-md rounded-2xl border border-primary/15 bg-white/90 text-left shadow-sm',
            compact ? 'p-3' : 'p-4 md:p-5'
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <IoSparkles size={16} className="text-secondary" />
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
              {tipsLabel}
            </span>
          </div>
          <ul className="space-y-2">
            {tips.map((tip) => {
              const Icon = tip.icon;
              return (
                <li key={tip.text} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      tip.iconBgClassName ?? 'bg-primary/10'
                    )}
                  >
                    <Icon size={18} className={tip.iconClassName ?? 'text-primary'} />
                  </span>
                  <p className="pt-1.5 text-[13px] font-semibold leading-snug text-foreground">{tip.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {action || secondaryAction ? (
        <div
          className={cn(
            'mt-6 flex w-full max-w-sm flex-col items-stretch gap-3 sm:flex-row sm:justify-center',
            !secondaryAction && 'sm:items-center'
          )}
        >
          {action ? <EmptyStateActionButton action={action} /> : null}
          {secondaryAction ? <EmptyStateActionButton action={secondaryAction} /> : null}
        </div>
      ) : null}
    </div>
  );
}
