import { cn } from '@/utils/cn';

type Props = {
  label?: string;
  tone?: 'light' | 'glass';
};

export function AuthDivider({ label = 'Or continue with email', tone = 'light' }: Props) {
  const glass = tone === 'glass';

  return (
    <div
      className={cn(
        'auth-divider flex items-center gap-3 sm:gap-4',
        glass ? 'my-5 max-lg:my-0' : 'my-6 max-lg:my-0'
      )}
    >
      <div
        className={cn(
          'h-px flex-1',
          glass ? 'bg-border lg:bg-border max-lg:bg-white/18' : 'bg-border'
        )}
      />
      <span
        className={cn(
          'auth-divider__label shrink-0 text-[12px] font-semibold tracking-wide',
          glass ? 'text-muted max-lg:text-white/55' : 'text-muted'
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          'h-px flex-1',
          glass ? 'bg-border lg:bg-border max-lg:bg-white/18' : 'bg-border'
        )}
      />
    </div>
  );
}
