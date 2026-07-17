'use client';

import { cn } from '@/utils/cn';

const STEPS = ['Agree', 'Pay', 'Meet', 'Done'] as const;

type Props = {
  /** 0–3 = index of last completed step (inclusive). Current step is activeIndex + 1. */
  activeIndex: number;
  className?: string;
};

export function EscrowStepIndicator({ activeIndex, className }: Props) {
  const clampedIndex = Math.max(0, Math.min(activeIndex, STEPS.length - 1));
  const allComplete = clampedIndex >= STEPS.length - 1;
  const visualProgress = allComplete
    ? 1
    : (clampedIndex + 0.5) / (STEPS.length - 1);

  return (
    <section
      className={cn('linkup-card px-3 py-4 sm:px-4', className)}
      aria-label={`Escrow progress: step ${Math.min(clampedIndex + 2, STEPS.length)} of ${STEPS.length}`}
    >
      <div className="relative pt-1">
        <div className="absolute left-[12%] right-[12%] top-5 h-0.5 bg-[#D8DCE6]" aria-hidden />
        <div
          className="absolute left-[12%] top-5 h-0.5 rounded-full bg-primary/50 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(visualProgress * 76, 0)}%` }}
          aria-hidden
        />
        <div className="relative grid grid-cols-4">
          {STEPS.map((label, i) => {
            const done = i <= clampedIndex;
            const current = !allComplete && i === clampedIndex + 1;

            return (
              <div key={label} className="flex flex-col items-center">
                {done ? (
                  <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full linkup-gradient-primary text-[13px] font-extrabold text-white shadow-sm">
                    {i + 1}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'mb-1.5 flex h-8 w-8 items-center justify-center rounded-full border bg-white text-[13px] font-extrabold transition-colors',
                      current
                        ? 'border-2 border-primary bg-primary/5 text-primary'
                        : 'border-[#D8DCE6] text-muted'
                    )}
                  >
                    {i + 1}
                  </span>
                )}
                <span
                  className={cn(
                    'text-center text-[10px] font-extrabold transition-colors',
                    done ? 'text-foreground' : current ? 'text-primary' : 'text-muted'
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
