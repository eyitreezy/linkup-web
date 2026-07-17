'use client';

import { cn } from '@/utils/cn';
import { IoCheckmark } from 'react-icons/io5';

export const CONFIRM_BOTTOM_BAR_CLEARANCE = 'pb-[11.5rem]';

export type ConfirmBottomBarProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  disabled?: boolean;
  confirmLabel?: string;
  isLoading?: boolean;
  className?: string;
};

export function ConfirmBottomBar({
  checked,
  onCheckedChange,
  onConfirm,
  disabled = false,
  confirmLabel = 'Confirm and continue',
  isLoading = false,
  className,
}: ConfirmBottomBarProps) {
  const confirmDisabled = disabled || !checked || isLoading;

  return (
    <div
      className={cn('fixed bottom-0 left-0 right-0 z-[60] border-t border-border/60 bg-white', className)}
      role="region"
      aria-label="Agreement confirmation"
    >
      <div className="mx-auto max-w-3xl px-4 pb-2 pt-4 sm:px-6">
        <label className="mb-4 flex cursor-pointer select-none items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-150',
              checked
                ? 'linkup-gradient-primary text-white shadow-sm'
                : 'border-2 border-primary/35 bg-white'
            )}
          >
            {checked ? <IoCheckmark size={15} aria-hidden /> : null}
          </button>
          <span className="text-[14px] font-semibold leading-relaxed text-foreground">
            I have read this summary and agree to the plan and policy.
          </span>
        </label>

        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="w-full rounded-full linkup-gradient-primary py-3.5 text-[15px] font-extrabold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden
              />
              Processing…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>

      <div className="h-6 bg-gradient-to-b from-white to-secondary/10" aria-hidden />
    </div>
  );
}
