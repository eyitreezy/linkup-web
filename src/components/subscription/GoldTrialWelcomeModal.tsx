'use client';

import { IoSparkles } from 'react-icons/io5';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GoldTrialWelcomeModal({ open, onOpenChange }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500">
          <IoSparkles size={32} className="text-white" />
        </div>
        <h2 className="font-display text-xl font-extrabold text-foreground">Welcome to your Gold trial!</h2>
        <p className="mt-3 text-[14px] font-semibold leading-relaxed text-muted">
          Enjoy 7 days of Gold features — extended mood plans, group plans, 72-hour boosts, and more.
        </p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 w-full rounded-full bg-amber-500 py-3 text-[15px] font-extrabold text-white transition hover:bg-amber-600"
        >
          Explore Gold features
        </button>
      </div>
    </div>
  );
}
