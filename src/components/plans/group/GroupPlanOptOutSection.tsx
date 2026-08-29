'use client';

import {
  fetchGuestOptOutTerms,
  submitGuestOptOut,
  type CancellationTerms,
} from '@/lib/groupPlan/liveLocation';
import { formatGroupParticipationError } from '@/lib/plans/groupParticipationErrors';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  planId: string;
  scheduledAt: string | null;
  isGuest: boolean;
  onOptedOut?: () => void;
};

const modalActionGrid = 'mt-4 grid grid-cols-2 gap-3';

const modalBtnBase =
  'flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-[14px] font-extrabold transition disabled:opacity-50';

export function GroupPlanOptOutSection({ planId, scheduledAt, isGuest, onOptedOut }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [terms, setTerms] = useState<CancellationTerms | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isGuest || !scheduledAt) return null;

  const hoursUntil = (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 48) return null;

  async function openModal() {
    setError(null);
    setModalOpen(true);
    setTerms(null);
    setBusy(true);
    const result = await fetchGuestOptOutTerms(planId);
    setBusy(false);
    if (result.error) {
      setError(formatGroupParticipationError(result.error));
      return;
    }
    setTerms(result.terms ?? null);
  }

  async function handleConfirmOptOut() {
    setBusy(true);
    setError(null);
    const result = await submitGuestOptOut(planId);
    setBusy(false);
    if (result.error) {
      setError(formatGroupParticipationError(result.error));
      return;
    }
    setModalOpen(false);
    onOptedOut?.();
    if (result.triggered_minimum_cancel) {
      setMessage(
        'You have opted out. Your opt-out caused the group to fall below the minimum required members. The plan has been cancelled and all remaining members have been refunded.'
      );
      setTimeout(() => router.push('/discover'), 2500);
      return;
    }
    setMessage('You have opted out. Any applicable refund has been processed to your wallet.');
    setTimeout(() => router.push('/discover'), 2500);
  }

  if (message) {
    return (
      <div className="linkup-card p-4">
        <p className="text-[14px] font-semibold text-emerald-800">{message}</p>
      </div>
    );
  }

  return (
    <>
      <div className="linkup-card space-y-3 border-amber-200/60 bg-amber-50/50 p-4">
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          You may opt out of this Group Plan up to 48 hours before the meetup. Any applicable cancellation
          policy will be applied based on the plan&apos;s current status and timing.
        </p>
        {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
        <button
          type="button"
          onClick={() => void openModal()}
          disabled={busy && !modalOpen}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#EF4444] px-4 text-[14px] font-extrabold text-white transition hover:bg-[#DC2626] disabled:opacity-50 sm:w-auto'
          )}
        >
          {busy ? 'Loading…' : 'Opt Out'}
        </button>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
          <div className="linkup-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
            <h2 className="font-display text-xl font-extrabold text-foreground">Opt out of this plan?</h2>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
              You are about to leave this plan. Any applicable cancellation policy will be applied based on
              the plan&apos;s current status and timing.
            </p>
            {busy && !terms ? (
              <p className="mt-4 text-[13px] font-semibold text-muted">Loading cancellation terms…</p>
            ) : null}
            {terms ? (
              <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-[#F5F6FA] p-4 text-[14px]">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-muted">Your refund</span>
                  <span className="font-extrabold text-foreground">
                    {terms.canceller_refund_percent}% of your contribution
                  </span>
                </div>
                {terms.other_party_penalty_percent > 0 ? (
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-muted">Host compensation</span>
                    <span className="text-right font-extrabold text-foreground">
                      {terms.other_party_penalty_percent}% of your contribution
                    </span>
                  </div>
                ) : null}
                <p className="pt-1 text-[12px] font-semibold text-muted">
                  {terms.hours_until_meetup} hours until the scheduled meetup. This action cannot be undone.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-[13px] font-semibold text-muted">
                Your participation will end and escrow may be refunded according to the plan cancellation
                rules.
              </p>
            )}
            {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
            <div className={modalActionGrid}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                className={cn(modalBtnBase, 'border border-border text-muted hover:bg-[#F5F6FA]')}
              >
                Keep plan
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmOptOut()}
                disabled={busy || (!terms && !!error)}
                className={cn(modalBtnBase, 'bg-[#EF4444] text-white hover:bg-[#DC2626]')}
              >
                {busy ? 'Processing…' : 'Opt Out'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
