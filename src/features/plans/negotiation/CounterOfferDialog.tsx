'use client';

import {
  buildRequirementsNotice,
  deriveInitialOfferRequirements,
  deriveInitialOfferSnapshot,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  validateCounterForm,
} from '@/lib/plans/initialOfferRequirements';
import { defaultCounterAmount } from '@/lib/plans/negotiationActions';
import { createClient } from '@/lib/supabase/client';
import type { DbPlanOffer, DbPlanOfferRound } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';

type Props = {
  open: boolean;
  offer: DbPlanOffer | null;
  planId: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (
    amountCents: number | null,
    note: string,
    proposedScheduledAt: string | null
  ) => void;
};

export function CounterOfferDialog({ open, offer, planId, busy, onClose, onSubmit }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proposedAt, setProposedAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const roundsQuery = useQuery({
    queryKey: ['offer-rounds', offer?.id],
    queryFn: async () => {
      if (!offer?.id) return [] as DbPlanOfferRound[];
      const client = createClient();
      const { data, error } = await client
        .from('plan_offer_rounds')
        .select('*')
        .eq('offer_id', offer.id)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as DbPlanOfferRound[];
    },
    enabled: open && !!offer?.id,
  });

  const requirements = useMemo(() => {
    if (!offer) {
      return { requireAmount: false, requireNote: false, requireDate: false };
    }
    const snapshot = deriveInitialOfferSnapshot(offer, roundsQuery.data ?? []);
    return deriveInitialOfferRequirements(snapshot);
  }, [offer, roundsQuery.data]);

  const requirementsNotice = useMemo(() => buildRequirementsNotice(requirements), [requirements]);

  useEffect(() => {
    if (open && offer) {
      setAmount(defaultCounterAmount(offer));
      setNote(offer.message?.trim() ?? '');
      setProposedAt(toDatetimeLocalValue(offer.proposed_scheduled_at));
      setFormError(null);
    }
  }, [open, offer]);

  if (!open || !offer) return null;

  function handleSubmit() {
    const trimmed = amount.trim();
    const cents = trimmed ? Math.round(Number(trimmed) * 100) : null;
    if (trimmed && (Number.isNaN(cents) || cents! < 0)) {
      setFormError('Enter a valid amount.');
      return;
    }
    const proposedScheduledAt = fromDatetimeLocalValue(proposedAt);
    const validationError = validateCounterForm(requirements, {
      amountCents: cents,
      note: note.trim(),
      proposedScheduledAt,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    onSubmit(cents, note.trim(), proposedScheduledAt);
  }

  const amountLabel = requirements.requireAmount ? 'Your counter amount (₦) *' : 'Your counter amount (₦)';
  const dateLabel = requirements.requireDate ? 'Proposed date & time *' : 'Proposed date & time';
  const noteLabel = requirements.requireNote ? 'Note *' : 'Note';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="counter-offer-title"
      onClick={onClose}
    >
      <div
        className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="counter-offer-title" className="font-display text-lg font-extrabold text-foreground">
            Send a counter offer
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-[#F5F6FA]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </div>

        <p className="mb-4 rounded-xl border border-primary/15 bg-[#EDE8FF]/40 px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-muted">
          {requirementsNotice}
        </p>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">{amountLabel}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={requirements.requireAmount ? 'Required' : 'e.g. 5000'}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">{dateLabel}</span>
            <input
              type="datetime-local"
              value={proposedAt}
              onChange={(e) => setProposedAt(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">{noteLabel}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={
                requirements.requireNote
                  ? 'Required: add context for your counter'
                  : 'Add a message with your counter…'
              }
              className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
            />
          </label>
        </div>

        {formError ? (
          <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{formError}</p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 min-[425px]:mt-6 min-[425px]:flex-row min-[425px]:justify-end min-[425px]:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] w-full rounded-full border border-border px-4 text-[14px] font-extrabold text-muted min-[425px]:w-auto min-[425px]:px-5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="min-h-[44px] w-full rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white disabled:opacity-50 min-[425px]:w-auto min-[425px]:px-5"
          >
            {busy ? 'Sending…' : 'Send counter'}
          </button>
        </div>
      </div>
    </div>
  );
}
