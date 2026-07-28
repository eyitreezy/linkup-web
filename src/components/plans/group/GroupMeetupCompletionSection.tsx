'use client';

import { confirmGroupMeetupHost } from '@/lib/groupPlan/annexureB';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  planId: string;
  onConfirmed?: () => void;
};

export function GroupMeetupCompletionSection({ planId, onConfirmed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const result = await confirmGroupMeetupHost(planId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not confirm meetup');
      return;
    }
    setDone(true);
    onConfirmed?.();
  }

  if (done) {
    return (
      <section className="linkup-card space-y-2 border-emerald-200/80 bg-emerald-50/80 p-5">
        <p className="text-[14px] font-extrabold text-emerald-800">Meetup confirmed</p>
        <p className="text-[13px] font-semibold text-emerald-700">
          Guests have been asked to confirm attendance. Outcome 3 applies automatically after 24 hours for
          members who do not respond.
        </p>
      </section>
    );
  }

  return (
    <section className="linkup-card space-y-3 p-5">
      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        Your group meetup time has passed. Confirm that the meetup happened to trigger disbursement for
        all confirmed members.
      </p>
      {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
      <button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={busy}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
        )}
      >
        {busy ? 'Confirming…' : 'Confirm Group Meetup Completed'}
      </button>
      <p className="text-[12px] font-semibold text-muted">
        Members who do not confirm within 24 hours will have Outcome 3 applied automatically.
      </p>
    </section>
  );
}
