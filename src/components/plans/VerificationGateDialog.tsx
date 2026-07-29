'use client';

import Link from 'next/link';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function VerificationGateDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="verification-gate-title"
      >
        <h2 id="verification-gate-title" className="font-display text-xl font-extrabold text-foreground">
          Verify to continue
        </h2>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
          Complete identity verification before making or accepting offers, with the same trust rules as the LinkUp app.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/kyc"
            className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm"
          >
            Start verification
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-5 py-2.5 text-[14px] font-extrabold text-muted"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
