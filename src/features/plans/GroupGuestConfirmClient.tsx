'use client';

import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { confirmGroupGuestAttendance } from '@/lib/groupPlan/annexureB';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoCheckmarkCircle } from 'react-icons/io5';

type Props = {
  planId: string;
  planTitle: string;
  alreadyConfirmed: boolean;
};

export function GroupGuestConfirmClient({ planId, planTitle, alreadyConfirmed }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    const result = await confirmGroupGuestAttendance(planId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not confirm attendance');
      return;
    }
    setConfirmed(true);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Group meetup confirmation"
        title={planTitle}
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
      />

      {confirmed ? (
        <div className="linkup-card flex items-start gap-3 p-5">
          <IoCheckmarkCircle size={28} className="shrink-0 text-emerald-600" />
          <div>
            <h2 className="font-display text-lg font-extrabold text-foreground">Attendance confirmed</h2>
            <p className="mt-1 text-[14px] font-semibold text-muted">
              Thank you for confirming. Disbursement will follow once all members are resolved.
            </p>
            <Link href="/wallet" className="mt-3 inline-block font-extrabold text-primary underline">
              Go to wallet
            </Link>
          </div>
        </div>
      ) : (
        <div className="linkup-card space-y-4 p-5">
          <h2 className="font-display text-xl font-extrabold text-foreground">Did you attend this meetup?</h2>
          <p className="text-[14px] font-semibold text-muted">
            The host confirmed the group meetup happened. Please confirm your attendance or submit an
            Exigency Report if you could not attend.
          </p>
          {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
            )}
          >
            {busy ? 'Confirming…' : 'Yes, I attended'}
          </button>
          <Link
            href={`/plan/${planId}/exigency`}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-primary/25 bg-white px-5 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50"
          >
            I did not attend. Submit Exigency Report
          </Link>
        </div>
      )}
    </div>
  );
}
