import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type Props = {
  kicker?: string;
  title: string;
  description?: string;
  /** Extra classes on the description line (e.g. hide on mobile). */
  descriptionClassName?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  /** Keep trailing control on the right in the same row as the title (300px+). */
  trailingInline?: boolean;
  className?: string;
  iconWrapperClassName?: string;
  kickerClassName?: string;
  titleClassName?: string;
};

/** Shared responsive header for main tab routes (300px+). */
export function TabPageHeader({
  kicker,
  title,
  description,
  descriptionClassName,
  icon,
  trailing,
  trailingInline,
  className,
  iconWrapperClassName,
  kickerClassName,
  titleClassName,
}: Props) {
  if (trailingInline) {
    return (
      <header
        className={cn(
          'pm-header-grid grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 max-[424px]:gap-x-1.5 max-[374px]:gap-x-1',
          className
        )}
      >
        {icon ? (
          <div
            className={cn(
              'pm-header-icon col-start-1 row-start-1 flex shrink-0 items-center justify-center rounded-2xl linkup-gradient-primary text-white shadow-md',
              'h-11 w-11 max-[424px]:h-9 max-[424px]:w-9 max-[424px]:rounded-xl max-[374px]:h-8 max-[374px]:w-8 max-[374px]:rounded-lg',
              iconWrapperClassName
            )}
          >
            {icon}
          </div>
        ) : null}
        <div className={cn('min-w-0 overflow-hidden', icon ? 'col-start-2' : 'col-start-1', 'row-start-1')}>
          {kicker ? (
            <p
              className={cn(
                'truncate text-[11px] font-extrabold uppercase tracking-wide text-secondary max-[424px]:text-[10px] max-[374px]:text-[9px]',
                kickerClassName
              )}
            >
              {kicker}
            </p>
          ) : null}
          <h1
            className={cn(
              'pm-header-title font-display font-extrabold tracking-tight text-foreground',
              'text-xl leading-snug line-clamp-2 max-[424px]:text-lg max-[374px]:text-base max-[300px]:text-[15px]',
              titleClassName
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'mt-1 max-w-2xl text-[14px] font-semibold leading-snug text-muted max-[424px]:mt-0.5 max-[424px]:text-[12px]',
                descriptionClassName
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {trailing ? (
          <div className="col-start-3 row-start-1 shrink-0 self-start">{trailing}</div>
        ) : null}
      </header>
    );
  }

  return (
    <header
      className={cn(
        'linkup-page-shell flex min-w-0 flex-col gap-3 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-start min-[400px]:justify-between',
        className
      )}
    >
      <div className="flex min-w-0 gap-2 min-[400px]:gap-4">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl linkup-gradient-primary text-white shadow-md min-[400px]:h-12 min-[400px]:w-12">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          {kicker ? (
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-secondary min-[400px]:text-[11px]">
              {kicker}
            </p>
          ) : null}
          <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground min-[400px]:text-2xl md:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'mt-1 max-w-2xl text-[13px] font-semibold leading-relaxed text-muted min-[400px]:text-[14px]',
                descriptionClassName
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}
