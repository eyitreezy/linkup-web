'use client';

import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { submitExigencyReport } from '@/lib/groupPlan/annexureB';
import { EXIGENCY_EVIDENCE_NDPR } from '@/lib/groupPlan/policySignOffContent';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useState } from 'react';

const REASONS = [
  { id: 'late_arrival', label: 'Late arrival (I arrived after the confirmation window)' },
  { id: 'illness', label: 'Illness or medical emergency' },
  { id: 'accident', label: 'Accident or injury' },
  { id: 'emergency', label: 'Other emergency (flood, family crisis, etc.)' },
  { id: 'transport', label: 'Transport or venue issue' },
  { id: 'venue_issue', label: 'Venue issue' },
  { id: 'other', label: 'Other' },
] as const;

type Props = {
  planId: string;
  planTitle: string;
};

export function ExigencyReportClient({ planId, planTitle }: Props) {
  const [step, setStep] = useState(1);
  const [reasonType, setReasonType] = useState<string>('');
  const [reasonText, setReasonText] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviewHours, setReviewHours] = useState(48);

  const isForce = ['illness', 'accident', 'emergency'].includes(reasonType);

  async function handleSubmit() {
    if (!reasonType || !reasonText.trim()) {
      setError('Please complete all required fields.');
      return;
    }
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.append('plan_id', planId);
    formData.append('reason_type', reasonType);
    formData.append('reason_text', reasonText.trim());
    if (evidence) formData.append('evidence', evidence);

    const result = await submitExigencyReport(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReviewHours(result.review_hours ?? (isForce ? 72 : 48));
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pb-16">
        <PlanFlowHeader
          kicker="Exigency Report"
          title={planTitle}
          backHref={`/plan/${planId}`}
          backLabel="Back to plan"
        />
        <div className="linkup-card space-y-3 p-5">
          <h2 className="font-display text-xl font-extrabold text-foreground">Report received</h2>
          <p className="text-[14px] font-semibold text-muted">
            Your Exigency Report has been received. The LinkUp team will review your case within{' '}
            {reviewHours} hours and notify you of the outcome by notification and in your wallet.
          </p>
          <Link href="/wallet" className="inline-block font-extrabold text-primary underline">
            Go to wallet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Exigency Report"
        title={planTitle}
        backHref={`/plan/${planId}/confirm`}
        backLabel="Back"
      />

      <div className="linkup-card space-y-4 p-5">
        {step === 1 ? (
          <>
            <h2 className="font-display text-lg font-extrabold text-foreground">Reason for absence</h2>
            <ul className="space-y-2">
              {REASONS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReasonType(r.id);
                      setStep(2);
                    }}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-left text-[14px] font-semibold transition hover:bg-[#EDE8FF]/50',
                      reasonType === r.id ? 'border-primary bg-[#EDE8FF]/40' : 'border-border'
                    )}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="font-display text-lg font-extrabold text-foreground">Describe what happened</h2>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-[14px] font-semibold outline-none focus:border-primary"
              placeholder="Provide details that help our team review your case."
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-[14px] font-extrabold text-muted"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!reasonText.trim()}
                onClick={() => setStep(3)}
                className="flex-1 rounded-full linkup-gradient-primary px-4 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="font-display text-lg font-extrabold text-foreground">Supporting evidence</h2>
            <p className="text-[13px] font-semibold text-muted">
              Upload a photo of your medical certificate, hospital record, or other documentation.
              {isForce ? ' Strongly recommended for emergency claims.' : ' Optional but helpful.'}
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
              className="text-[13px] font-semibold"
            />
            <p className="text-[12px] font-semibold leading-relaxed text-muted">
              {EXIGENCY_EVIDENCE_NDPR}
            </p>
            {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-[14px] font-extrabold text-muted"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                className="flex-1 rounded-full linkup-gradient-primary px-4 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
              >
                {busy ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
