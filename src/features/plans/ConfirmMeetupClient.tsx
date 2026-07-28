'use client';

import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { confirmMeetupHappened } from '@/lib/wallet/disburseWallet';
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

export function ConfirmMeetupClient({ planId, planTitle, alreadyConfirmed }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await confirmMeetupHappened(planId);
      if (!result.ok) {
        setError(result.error ?? 'Could not confirm meetup');
        return;
      }
      setConfirmed(true);
      router.push('/wallet');
      router.refresh();
    } catch {
      setError('Could not confirm meetup');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Meetup confirmation"
        title={planTitle}
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
      />

      {confirmed ? (
        <div className="linkup-card flex items-start gap-3 p-5">
          <IoCheckmarkCircle size={28} className="shrink-0 text-emerald-600" />
          <div>
            <h2 className="font-display text-lg font-extrabold text-foreground">You confirmed this meetup</h2>
            <p className="mt-1 text-[14px] font-semibold text-muted">
              Escrow releases and wallet updates may take a moment. Check your wallet for available funds.
            </p>
            <Link href="/wallet" className="mt-3 inline-block font-extrabold text-primary underline">
              Go to wallet
            </Link>
          </div>
        </div>
      ) : (
        <div className="linkup-card space-y-4 p-5">
          <h2 className="font-display text-xl font-extrabold text-foreground">Did this meetup happen?</h2>
          <p className="text-[14px] font-semibold text-muted">
            Confirming releases escrow to the right party and starts the withdrawal timeline for wallet funds.
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
            {busy ? 'Confirming…' : 'Yes, it happened'}
          </button>
          <Link
            href={`/dispute/${planId}/detail`}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-primary/25 bg-white px-5 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50"
          >
            No, report a problem
          </Link>
        </div>
      )}
    </div>
  );
}
