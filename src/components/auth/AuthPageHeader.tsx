import { LinkUpLogo } from '@/components/brand/LinkUpLogo';
import { cn } from '@/utils/cn';

type Props = {
  headingVariant?: 'join-logo' | 'text';
  title?: string;
  subtitle?: string;
  className?: string;
};

/** Shared auth page heading — desktop card + mobile glass card. */
export function AuthPageHeader({ headingVariant = 'text', title, subtitle, className }: Props) {
  if (headingVariant !== 'join-logo' && !title && !subtitle) return null;

  return (
    <div className={cn('auth-page-header mb-8 text-left max-lg:mb-4', className)}>
      {headingVariant === 'join-logo' ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-display text-[26px] font-extrabold leading-none tracking-tight text-foreground max-lg:text-white">
            Join
          </span>
          <LinkUpLogo width={112} className="shrink-0" />
        </div>
      ) : title ? (
        <h1 className="font-display text-[26px] font-extrabold leading-snug tracking-tight text-foreground max-lg:text-white">
          {title}
        </h1>
      ) : null}
      {subtitle ? (
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted max-lg:text-white/85">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
