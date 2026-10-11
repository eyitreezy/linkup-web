'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { MatchMakerSlideIn } from '@/features/matchmaker/MatchMakerSlideIn';
import { onboardingFieldClass } from '@/lib/onboarding/formFieldClass';
import {
  MISALIGNMENT_REPORT_MAX_EXPLANATION,
  MISALIGNMENT_REPORT_REASONS,
  sanitizeMisalignmentExplanation,
  validateMisalignmentSubmission,
  type MisalignmentReportReasonCode,
} from '@/lib/matchmaker/misalignmentReport';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { submitMatchMakerConnectionReport } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

type Props = {
  open: boolean;
  connectionId: string;
  onClose: () => void;
};

export function MatchMakerConnectionReportSheet({ open, connectionId, onClose }: Props) {
  const [reason, setReason] = useState<MisalignmentReportReasonCode | null>(null);
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function submit() {
    const check = validateMisalignmentSubmission(reason, explanation);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await submitMatchMakerConnectionReport(createClient(), {
      connectionId,
      reasonCode: reason!,
      explanation: explanation.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    setDone(true);
  }

  function close() {
    setReason(null);
    setExplanation('');
    setError(null);
    setDone(false);
    onClose();
  }

  return (
    <MatchMakerSlideIn>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={close}>
        <div
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#FDF8F4] p-6 shadow-xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="mm-report-title"
        >
          {done ? (
            <>
              <h2 id="mm-report-title" className="font-display text-xl font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                Your report has been received.
              </h2>
              <button
                type="button"
                onClick={close}
                className="mt-8 w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <h2 id="mm-report-title" className="font-display text-xl font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                Report a concern
              </h2>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
                This is separate from blocking. Use this if you feel this connection is not being used with sincere
                intent.
              </p>

              <FormCard className="mt-6">
                <p className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Reason
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {MISALIGNMENT_REPORT_REASONS.map((opt) => (
                    <GradientChip
                      key={opt.code}
                      label={opt.label}
                      selected={reason === opt.code}
                      onClick={() => {
                        setReason(opt.code);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </FormCard>

              <div className="mt-4 space-y-1">
                <label htmlFor="mm-report-note" className="block text-[12px] font-extrabold text-muted">
                  Optional details
                </label>
                <textarea
                  id="mm-report-note"
                  value={explanation}
                  rows={3}
                  maxLength={MISALIGNMENT_REPORT_MAX_EXPLANATION}
                  onChange={(e) => setExplanation(sanitizeMisalignmentExplanation(e.target.value))}
                  className={onboardingFieldClass}
                  placeholder="Add context (optional)"
                />
                <p className="text-right text-[11px] font-semibold text-muted">
                  {explanation.length}/{MISALIGNMENT_REPORT_MAX_EXPLANATION}
                </p>
              </div>

              {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-[48px] flex-1 rounded-full border bg-white text-[14px] font-extrabold"
                  style={{ borderColor: MATCHMAKER_THEME.border }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="min-h-[48px] flex-1 rounded-full linkup-gradient-primary text-[14px] font-extrabold text-white disabled:opacity-60"
                >
                  {busy ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </MatchMakerSlideIn>
  );
}
