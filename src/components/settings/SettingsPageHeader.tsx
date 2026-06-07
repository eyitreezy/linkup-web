import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoArrowBack } from 'react-icons/io5';

type Props = {
  kicker: string;
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function SettingsPageHeader({
  kicker,
  title,
  subtitle,
  backHref = '/profile',
  backLabel = 'Back to profile',
  actions,
  className,
}: Props) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          href={backHref}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 text-foreground shadow-sm transition hover:bg-[#EDE8FF]/60"
          aria-label={backLabel}
        >
          <IoArrowBack size={22} />
        </Link>
        {actions}
      </div>
      <header className="flex gap-4">
        <div className="mt-2 h-14 w-1 shrink-0 rounded-full linkup-gradient-primary" aria-hidden />
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">{kicker}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 max-w-2xl text-[14px] font-semibold leading-relaxed text-muted">{subtitle}</p>
        </div>
      </header>
    </div>
  );
}
