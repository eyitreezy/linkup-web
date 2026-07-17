'use client';

import { cn } from '@/utils/cn';

type Props = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export function EscrowFundCTA({
  title,
  subtitle,
  onPress,
  disabled,
  loading,
  className,
}: Props) {
  const off = disabled || loading;

  return (
    <div className={cn('space-y-2', className)}>
      {subtitle ? (
        <p className="text-center text-[14px] font-semibold leading-relaxed text-muted">{subtitle}</p>
      ) : null}
      <button
        type="button"
        onClick={onPress}
        disabled={off}
        className={cn(
          'w-full rounded-full py-4 text-[17px] font-extrabold text-white shadow-lg transition active:scale-[0.985]',
          off ? 'cursor-not-allowed bg-border text-white/70' : 'linkup-gradient-primary hover:opacity-95'
        )}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Please wait…
          </span>
        ) : (
          title
        )}
      </button>
    </div>
  );
}
