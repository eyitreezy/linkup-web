'use client';

import { IoSparkles } from 'react-icons/io5';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SilverTrialWelcomeModal({ open, onOpenChange }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl linkup-gradient-primary">
          <IoSparkles size={32} className="text-white" />
        </div>
        <h2 className="font-display text-xl font-extrabold text-foreground">
          Your 7-day Silver Explorer trial has started
        </h2>
        <p className="mt-3 text-[14px] font-semibold leading-relaxed text-muted">
          Explore advanced filters, bookmarks, read receipts, and more — no card required.
        </p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 w-full rounded-full linkup-gradient-primary py-3 text-[15px] font-extrabold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
