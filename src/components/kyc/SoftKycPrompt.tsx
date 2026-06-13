'use client';

import { clearSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoClose, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify?: () => void;
};

export function SoftKycPrompt({ open, onOpenChange, onVerify }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function dismiss() {
    setBusy(true);
    await clearSoftKycPromptPending();
    setBusy(false);
    onOpenChange(false);
  }

  async function verify() {
    setBusy(true);
    await clearSoftKycPromptPending();
    setBusy(false);
    onOpenChange(false);
    if (onVerify) onVerify();
    else router.push('/trust');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => void dismiss()} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl border border-border bg-white p-5 shadow-xl sm:rounded-3xl"
        role="dialog"
        aria-labelledby="soft-kyc-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IoShieldCheckmark className="text-primary" size={22} />
            <h2 id="soft-kyc-title" className="font-display text-xl font-extrabold text-foreground">
              Unlock more with verification
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="rounded-full p-2 text-muted hover:bg-[#F5F6FA]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </div>
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          A quick check helps everyone trust who they&apos;re meeting — and unlocks paid features fairly.
        </p>
        <ul className="mt-4 space-y-2 text-[14px] font-semibold text-foreground">
          <li className="flex items-center gap-2">
            <span className="font-extrabold text-primary">✔</span> Create plans
          </li>
          <li className="flex items-center gap-2">
            <span className="font-extrabold text-primary">✔</span> Negotiate meetups
          </li>
          <li className="flex items-center gap-2">
            <span className="font-extrabold text-primary">✔</span> Use secure escrow
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void verify()}
            className="w-full rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            Verify now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void dismiss()}
            className="w-full rounded-full border border-border py-3 text-[14px] font-extrabold text-muted disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
