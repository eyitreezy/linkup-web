'use client';

import { submitGuestOptOut } from '@/lib/groupPlan/liveLocation';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  planId: string;
  scheduledAt: string | null;
  isGuest: boolean;
};

export function GroupPlanOptOutSection({ planId, scheduledAt, isGuest }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isGuest || !scheduledAt) return null;

  const hoursUntil = (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 48) return null;

  async function handleOptOut() {
    if (!window.confirm('Opt out of this Group Plan? Your contribution will be refunded in full.')) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await submitGuestOptOut(planId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.triggered_minimum_cancel) {
      setMessage(
        'You have opted out. Your opt-out caused the group to fall below the minimum of 5 members. The plan has been cancelled and all remaining members have been refunded.'
      );
    } else {
      setMessage('You have opted out. Your refund has been processed to your wallet.');
    }
  }

  if (message) {
    return (
      <div className="linkup-card p-4">
        <p className="text-[14px] font-semibold text-emerald-800">{message}</p>
      </div>
    );
  }

  return (
    <div className="linkup-card space-y-3 border-amber-200/60 bg-amber-50/50 p-4">
      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        You may opt out of this Group Plan up to 48 hours before the meetup. Your contribution will be
        refunded in full including the platform fee.
      </p>
      {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
      <button
        type="button"
        onClick={() => void handleOptOut()}
        disabled={busy}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-center rounded-full border-2 border-[#EF4444] px-4 text-[14px] font-extrabold text-[#EF4444] disabled:opacity-50 sm:w-auto'
        )}
      >
        {busy ? 'Processing…' : 'Opt out of this plan'}
      </button>
    </div>
  );
}
