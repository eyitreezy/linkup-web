'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { IoCheckmarkCircle } from 'react-icons/io5';

type Props = {
  title?: string;
  message: string;
  continueLabel?: string;
  onContinue: () => void;
};

export function EscrowPaymentSuccessModal({
  title = 'Payment confirmed',
  message,
  continueLabel = 'Continue',
  onContinue,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escrow-payment-success-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <IoCheckmarkCircle size={36} className="text-emerald-600" aria-hidden />
        </div>
        <h2 id="escrow-payment-success-title" className="font-display text-[22px] font-extrabold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-[14px] font-semibold text-muted">{message}</p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-full linkup-gradient-primary px-6 text-[15px] font-extrabold text-white"
        >
          {continueLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}
