'use client';

import { removeGroupGuest } from '@/lib/plans/removeGroupGuest';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  planId: string;
  guestUserId: string;
  guestName: string;
  guestFunded: boolean;
  onRemoved: (result: { refunded: boolean; amountCents?: number }) => void;
  onDismiss: () => void;
};

const REASON_OPTIONS = [
  { value: 'disruptive_behavior', label: 'Disruptive behavior' },
  { value: 'no_show_risk', label: 'No-show risk' },
  { value: 'duplicate_slot', label: 'Duplicate slot' },
  { value: 'changed_plans', label: 'Guest changed plans' },
  { value: 'other', label: 'Other' },
];

const modalActionGrid = 'mt-4 grid grid-cols-2 gap-3';

const modalBtnBase =
  'flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-[14px] font-extrabold transition disabled:opacity-50';

function formatRemoveError(message: string): string {
  const m = message.trim();
  if (m.includes('not_authenticated')) return 'Please sign in and try again.';
  if (m.includes('not_plan_host')) return 'Only the host can remove guests.';
  if (m.includes('guest_not_on_plan')) return 'This guest is no longer on the plan.';
  if (m.includes('plan_not_removable')) return 'Guests cannot be removed from this plan anymore.';
  return message;
}

export function GroupGuestRemoveModal({
  planId,
  guestUserId,
  guestName,
  guestFunded,
  onRemoved,
  onDismiss,
}: Props) {
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmRemove() {
    if (!reasonType) return;
    if (reasonType === 'other' && !reasonText.trim()) return;

    setBusy(true);
    setError(null);
    const result = await removeGroupGuest(planId, guestUserId, {
      reason_type: reasonType,
      reason_text: reasonText.trim() || undefined,
    });
    setBusy(false);

    if (result.error) {
      setError(formatRemoveError(result.error));
      return;
    }

    onRemoved({
      refunded: result.refunded === true,
      amountCents: result.amountCents,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="linkup-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
        <h2 className="font-display text-xl font-extrabold text-foreground">Remove guest</h2>
        <p className="mt-2 text-[14px] font-semibold text-muted">
          Remove <span className="font-extrabold text-foreground">{guestName}</span> from this group
          plan? Please select a reason before confirming.
        </p>
        {guestFunded ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] font-semibold text-amber-900">
            This guest has already contributed. Their share minus the app fee will be refunded to their
            wallet.
          </p>
        ) : null}
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
            placeholder="Please describe why you are removing this guest."
            rows={3}
            className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
          />
        ) : null}
        {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
        <div className={modalActionGrid}>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className={cn(modalBtnBase, 'border border-border text-muted hover:bg-[#F5F6FA]')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmRemove()}
            disabled={!reasonType || (reasonType === 'other' && !reasonText.trim()) || busy}
            className={cn(modalBtnBase, 'bg-[#EF4444] text-white hover:opacity-95')}
          >
            {busy ? 'Removing…' : 'Remove guest'}
          </button>
        </div>
      </div>
    </div>
  );
}
