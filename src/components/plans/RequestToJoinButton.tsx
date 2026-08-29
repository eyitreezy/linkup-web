'use client';

import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { submitJoinRequest } from '@/lib/plans/joinRequests';
import { formatGroupParticipationError } from '@/lib/plans/groupParticipationErrors';
import { planExpiredDialogContent } from '@/lib/plans/planExpiredDialog';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import { IoPersonAddOutline } from 'react-icons/io5';

const actionPrimary =
  'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50';

type Props = {
  planId: string;
  suggestedAmountCents?: number | null;
  currency?: string;
  planListingExpired?: boolean;
  onSuccess?: () => void;
  onPlanExpired?: () => void;
  className?: string;
};

export function RequestToJoinButton({
  planId,
  suggestedAmountCents,
  currency = 'NGN',
  planListingExpired = false,
  onSuccess,
  onPlanExpired,
  className,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredDialog, setExpiredDialog] = useState<{ title: string; message: string } | null>(
    null
  );

  function openJoinDialog() {
    if (planListingExpired) {
      const content = planExpiredDialogContent('join');
      setExpiredDialog(content);
      onPlanExpired?.();
      return;
    }
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (planListingExpired) {
      setExpiredDialog(planExpiredDialogContent('join'));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await submitJoinRequest(planId, message.trim() || undefined);
      setDialogOpen(false);
      setMessage('');
      onSuccess?.();
    } catch (err) {
      console.error('[join-request]', err);
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message?: string }).message)
            : '';
      if (raw.toLowerCase().includes('plan_listing_expired')) {
        setDialogOpen(false);
        setExpiredDialog(planExpiredDialogContent('join'));
        onPlanExpired?.();
        return;
      }
      setError(formatGroupParticipationError(raw || 'Could not send your request. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openJoinDialog} className={cn(actionPrimary, className)}>
        <IoPersonAddOutline size={18} />
        Request to join
      </button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-request-title"
        >
          <div className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6">
            <h2 id="join-request-title" className="font-display text-lg font-extrabold text-foreground">
              Request to join
            </h2>

            {suggestedAmountCents && suggestedAmountCents > 0 ? (
              <p className="mt-2 text-[14px] font-semibold text-muted">
                {`Your slot will be ${formatEscrowMoney(suggestedAmountCents, currency)} if approved.`}
              </p>
            ) : null}

            <div className="mt-4">
              <label
                htmlFor="join-request-message"
                className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-muted"
              >
                Message to host (optional)
              </label>
              <textarea
                id="join-request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself or add a note..."
                maxLength={200}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-[14px] font-semibold text-foreground outline-none focus:border-primary/40"
              />
            </div>

            {error ? <p className="mt-2 text-[13px] font-semibold text-red-600">{error}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 min-[425px]:mt-6 min-[425px]:flex-row min-[425px]:justify-end min-[425px]:gap-3">
              <button
                type="button"
                onClick={() => !isSubmitting && setDialogOpen(false)}
                disabled={isSubmitting}
                className="min-h-[44px] w-full rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50 min-[425px]:w-auto min-[425px]:px-5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
                className="min-h-[44px] w-full rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50 min-[425px]:w-auto min-[425px]:px-5"
              >
                {isSubmitting ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppStatusDialog
        open={expiredDialog !== null}
        variant="info"
        title={expiredDialog?.title ?? ''}
        message={expiredDialog?.message ?? ''}
        onClose={() => setExpiredDialog(null)}
      />
    </>
  );
}
