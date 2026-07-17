'use client';

import { EscrowModalShell } from '@/components/escrow/EscrowModalShell';
import { EscrowNoticeBanner } from '@/components/escrow/EscrowNoticeBanner';
import { ESCROW_DISPUTE_REASONS } from '@/lib/escrow/disputeReasons';
import { formatEscrowDate } from '@/lib/escrow/escrowFormatters';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useState } from 'react';
import { IoAlertCircleOutline, IoCheckmarkCircle, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  open: boolean;
  loading?: boolean;
  effectiveTier?: string;
  slaDeadline?: string | null;
  disputeSubmitted?: boolean;
  onClose: () => void;
  onSubmit: (reasonId: string, reasonLabel: string, detail: string) => void;
};

export function OpenDisputeModal({
  open,
  loading,
  effectiveTier,
  slaDeadline,
  disputeSubmitted,
  onClose,
  onSubmit,
}: Props) {
  const [reasonId, setReasonId] = useState(ESCROW_DISPUTE_REASONS[0]?.id ?? 'other');
  const [detail, setDetail] = useState('');

  function submit() {
    const label = ESCROW_DISPUTE_REASONS.find((r) => r.id === reasonId)?.label ?? 'Other';
    onSubmit(reasonId, label, detail);
  }

  return (
    <EscrowModalShell open={open} onClose={onClose} maxWidth="lg" showClose={!loading}>
      {disputeSubmitted ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <IoCheckmarkCircle size={24} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Submitted</p>
              <h2 className="font-display text-xl font-extrabold text-foreground">Dispute opened</h2>
              <p className="mt-1 text-[14px] font-semibold text-muted">
                Funds stay on hold while our team reviews. A support ticket was created automatically.
              </p>
            </div>
          </div>

          {effectiveTier === 'PLATINUM' && slaDeadline ? (
            <EscrowNoticeBanner
              tone="platinum"
              icon={<IoShieldCheckmark className="text-violet-600" size={20} />}
              title="Platinum priority dispute"
            >
              <p>Your dispute will be reviewed within 36 hours.</p>
              <p className="mt-1 text-[12px]">
                Estimated resolution by{' '}
                <span className="font-extrabold">{formatEscrowDate(slaDeadline)}</span>
              </p>
            </EscrowNoticeBanner>
          ) : null}

          <div className="flex flex-col-reverse gap-2 min-[425px]:flex-row min-[425px]:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted"
            >
              Close
            </button>
            <Link
              href="/disputes"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white"
            >
              View disputes
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <IoAlertCircleOutline size={24} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Escrow</p>
              <h2 className="font-display text-xl font-extrabold text-foreground">Open a dispute</h2>
              <p className="mt-1 text-[14px] font-semibold text-muted">
                Funds stay on hold while our team reviews. A support ticket is created automatically.
              </p>
            </div>
          </div>

          <p className="mt-6 text-[12px] font-extrabold uppercase tracking-wide text-muted">What happened?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ESCROW_DISPUTE_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReasonId(r.id)}
                className={cn(
                  'rounded-full border px-3 py-2 text-[12px] font-extrabold transition',
                  reasonId === r.id
                    ? 'linkup-gradient-primary border-transparent text-white shadow-sm'
                    : 'border-border bg-white text-foreground hover:border-primary/30'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-[12px] font-extrabold uppercase tracking-wide text-muted">
            Tell us more (optional)
          </label>
          <textarea
            className="mt-2 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[14px] font-semibold outline-none ring-primary/20 transition focus:ring-2"
            rows={4}
            placeholder="Add context. Helps us resolve faster."
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />

          <div className="mt-6 flex flex-col-reverse gap-2 min-[425px]:flex-row min-[425px]:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="min-h-[44px] rounded-full bg-[#EF4444] px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit dispute'}
            </button>
          </div>
        </>
      )}
    </EscrowModalShell>
  );
}
