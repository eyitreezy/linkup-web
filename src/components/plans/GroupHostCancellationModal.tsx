'use client';

import {
  fetchCancellationTerms,
  submitGroupHostCancellation,
  type CancellationTerms,
} from '@/lib/groupPlan/liveLocation';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  planId: string;
  onCancelled: () => void;
  onDismiss: () => void;
};

type Step = 'reason' | 'confirm';

const REASON_OPTIONS = [
  { value: 'logistical_issue', label: 'Logistical issue' },
  { value: 'personal_emergency', label: 'Personal emergency' },
  { value: 'insufficient_group_size', label: 'Insufficient group size' },
  { value: 'venue_issue', label: 'Venue issue' },
  { value: 'other', label: 'Other' },
];

export function GroupHostCancellationModal({ planId, onCancelled, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('reason');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [terms, setTerms] = useState<CancellationTerms | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReasonContinue() {
    if (!reasonType) return;
    if (reasonType === 'other' && !reasonText.trim()) return;
    setBusy(true);
    setError(null);
    const result = await fetchCancellationTerms(planId);
    setBusy(false);
    if (result.error || !result.terms) {
      setError(result.error ?? 'Could not load cancellation terms');
      return;
    }
    setTerms(result.terms);
    setStep('confirm');
  }

  async function handleConfirmCancellation() {
    setBusy(true);
    setError(null);
    const result = await submitGroupHostCancellation({
      plan_id: planId,
      reason_type: reasonType,
      reason_text: reasonText.trim() || undefined,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCancelled();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="linkup-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
        {step === 'reason' ? (
          <>
            <h2 className="font-display text-xl font-extrabold text-foreground">Cancel Group Plan</h2>
            <p className="mt-2 text-[14px] font-semibold text-muted">
              Please select a reason for cancelling this plan.
            </p>
            <div className="mt-4 space-y-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReasonType(opt.value)}
                  className={cn(
                    'flex w-full rounded-xl border px-4 py-3 text-left text-[14px] font-extrabold transition',
                    reasonType === opt.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-foreground hover:bg-[#F5F6FA]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {reasonType === 'other' ? (
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Please describe the reason for cancellation."
                rows={3}
                className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
              />
            ) : null}
            {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
            <button
              type="button"
              onClick={() => void handleReasonContinue()}
              disabled={
                !reasonType || (reasonType === 'other' && !reasonText.trim()) || busy
              }
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary text-[14px] font-extrabold text-white disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-full border border-border text-[14px] font-extrabold text-muted"
            >
              Go back
            </button>
          </>
        ) : terms ? (
          <>
            <h2 className="font-display text-xl font-extrabold text-foreground">Confirm cancellation</h2>
            <p className="mt-2 text-[14px] font-semibold text-muted">
              Cancelling now ({terms.hours_until_meetup} hours before the meetup) means the following will
              apply:
            </p>
            <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-[#F5F6FA] p-4 text-[14px]">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-muted">Your refund</span>
                <span className="font-extrabold text-foreground">
                  {terms.canceller_refund_percent}% of your contribution
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-muted">Penalty to each guest</span>
                <span className="text-right font-extrabold text-foreground">
                  {terms.other_party_penalty_percent}% of your contribution distributed proportionally
                </span>
              </div>
              {terms.other_party_goodwill_credit !== 'none' ? (
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-muted">Guest compensation</span>
                  <span className="font-extrabold text-foreground">
                    {terms.other_party_goodwill_credit === 'enhanced' ? 'Enhanced' : 'Standard'} Goodwill
                    Credits
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-muted">Trust impact</span>
                <span className="text-right font-extrabold text-[#EF4444]">
                  {terms.trust_strikes} strike{terms.trust_strikes !== 1 ? 's' : ''}
                  {terms.visibility_reduction_percent > 0
                    ? `, ${terms.visibility_reduction_percent}% visibility reduction for ${terms.visibility_reduction_days} days`
                    : ''}
                  {terms.creation_hold_days > 0
                    ? `, ${terms.creation_hold_days}-day plan creation hold`
                    : ''}
                  {terms.requires_admin_review ? ', admin review required' : ''}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[12px] font-semibold text-muted">
              All guest contributions will be refunded to their wallets immediately. This action cannot be
              undone.
            </p>
            {error ? <p className="mt-2 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
            <button
              type="button"
              onClick={() => void handleConfirmCancellation()}
              disabled={busy}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#EF4444] text-[14px] font-extrabold text-white disabled:opacity-50"
            >
              {busy ? 'Cancelling…' : 'Confirm cancellation'}
            </button>
            <button
              type="button"
              onClick={() => setStep('reason')}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-full border border-border text-[14px] font-extrabold text-muted"
            >
              Go back
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
