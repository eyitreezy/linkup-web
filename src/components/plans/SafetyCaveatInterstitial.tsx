'use client';

import { acknowledgeSafetyCaveat } from '@/lib/groupPlan/annexureB';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  onAcknowledged: () => void;
};

export function SafetyCaveatInterstitial({ planId, onAcknowledged }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleAcknowledge() {
    setBusy(true);
    const result = await acknowledgeSafetyCaveat(planId);
    setBusy(false);
    if (result.ok) onAcknowledged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="linkup-card w-full max-w-md p-6 shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE8FF]">
            <IoShieldCheckmarkOutline size={28} className="text-primary" />
          </div>
        </div>
        <h2 className="text-center font-display text-xl font-extrabold text-foreground">
          Your safety comes first
        </h2>
        <p className="mt-3 text-[14px] font-semibold leading-relaxed text-muted">
          We strongly recommend your first meetup with this person takes place in a public space. A
          restaurant, a cafe, a lounge, or any publicly accessible venue.
        </p>
        <p className="mt-3 text-[14px] font-extrabold text-foreground">Prioritise your safety. Trust your instincts.</p>
        <button
          type="button"
          onClick={() => void handleAcknowledge()}
          disabled={busy}
          className={cn(
            'mt-5 flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
          )}
        >
          {busy ? 'Saving…' : 'I understand'}
        </button>
      </div>
    </div>
  );
}
