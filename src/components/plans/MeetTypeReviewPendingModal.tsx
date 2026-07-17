'use client';

import { IoClose, IoTimeOutline } from 'react-icons/io5';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetTypeName: string;
  mode: 'submitted' | 'pending';
};

/** Shown after custom type submission or when tapping a pending chip/tile. */
export function MeetTypeReviewPendingModal({ open, onOpenChange, meetTypeName, mode }: Props) {
  if (!open) return null;

  const title = mode === 'submitted' ? 'Meet type submitted!' : 'Awaiting approval';
  const message =
    mode === 'submitted'
      ? `"${meetTypeName}" has been submitted for review. An admin will approve it shortly. You'll be notified when it's ready to use.`
      : `"${meetTypeName}" is still under review by our team. You'll receive a notification once it's approved.`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative linkup-card w-full max-w-md overflow-hidden rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meet-type-review-title"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/10 to-transparent" />
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-white/90 text-muted hover:text-primary"
          aria-label="Close"
        >
          <IoClose size={18} />
        </button>
        <div className="relative space-y-4 p-5 text-center min-[425px]:p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
            <IoTimeOutline size={28} className="text-amber-700" aria-hidden />
          </div>
          <div className="pr-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
              Custom type
            </p>
            <h3 id="meet-type-review-title" className="font-display text-xl font-extrabold text-foreground">
              {title}
            </h3>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">{message}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] w-full rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
