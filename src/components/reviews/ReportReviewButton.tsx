'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import { useState } from 'react';

const REASONS = [
  { value: 'inaccurate', label: 'Inaccurate or misleading' },
  { value: 'abusive', label: 'Abusive or offensive' },
  { value: 'retaliatory', label: 'Appears retaliatory' },
  { value: 'spam', label: 'Spam or irrelevant' },
  { value: 'other', label: 'Other' },
] as const;

type ReasonValue = (typeof REASONS)[number]['value'];

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonValue | ''>('');
  const [reasonText, setReasonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit() {
    if (!reason) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to report a review.');

      const { error: insertError } = await supabase.from('review_reports').insert({
        review_id: reviewId,
        reporter_id: user.id,
        reason,
        reason_text: reasonText.trim() || null,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    if (submitted) {
      setSubmitted(false);
      setReason('');
      setReasonText('');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
        aria-label="Report this review"
      >
        Report
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-review-title"
        >
          <div className="linkup-card w-full max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6">
            {submitted ? (
              <>
                <h2 id="report-review-title" className="font-display text-lg font-extrabold text-foreground">
                  Report submitted
                </h2>
                <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
                  Thank you. The LinkUp team will review this report within 48 hours.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-5 min-h-[44px] w-full rounded-full linkup-gradient-primary text-[14px] font-extrabold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 id="report-review-title" className="font-display text-lg font-extrabold text-foreground">
                  Report this review
                </h2>

                <div className="mt-4 space-y-2">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="report_reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-[14px] font-semibold text-foreground">{r.label}</span>
                    </label>
                  ))}
                </div>

                {reason === 'other' ? (
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Please describe the issue."
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
                  />
                ) : null}

                {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

                <div className="mt-5 flex flex-col-reverse gap-2 min-[425px]:flex-row min-[425px]:justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!reason || isSubmitting}
                    className={cn(
                      'min-h-[44px] rounded-full px-5 text-[14px] font-extrabold text-white linkup-gradient-primary disabled:opacity-50'
                    )}
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
