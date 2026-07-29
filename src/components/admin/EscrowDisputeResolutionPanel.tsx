'use client';

import { ToggleRow } from '@/components/settings/ToggleRow';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { AdminPrimaryButton } from '@/features/admin/adminUi';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { createClient } from '@/lib/supabase/client';
import { resolveEscrowDisputeRpc } from '@/services/admin.service';
import type { EscrowDisputeRow } from '@/services/admin.service';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  dispute: EscrowDisputeRow;
  payerLabel: string;
  payeeLabel: string;
  onResolved: () => void;
};

function netAmountCents(esc: EscrowDisputeRow['escrow_row']): number {
  if (!esc) return 0;
  const fee = esc.platform_fee_cents ?? Math.round(esc.amount_cents * 0.06);
  return Math.max(0, esc.amount_cents - fee);
}

export function EscrowDisputeResolutionPanel({
  dispute,
  payerLabel,
  payeeLabel,
  onResolved,
}: Props) {
  const esc = dispute.escrow_row;
  const [showSplitInput, setShowSplitInput] = useState(false);
  const [splitPercent, setSplitPercent] = useState('50');
  const [resolutionNote, setResolutionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    decision: 'release' | 'refund' | 'split';
    title: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goodwillError, setGoodwillError] = useState<string | null>(null);
  const [issueGoodwillOnResolve, setIssueGoodwillOnResolve] = useState(false);
  const [goodwillAmount, setGoodwillAmount] = useState('');

  const net = netAmountCents(esc);
  const currency = esc?.currency ?? 'NGN';
  const gross = esc?.amount_cents ?? 0;
  const splitPct = Math.min(100, Math.max(0, parseFloat(splitPercent) || 0));
  const payeeShare = Math.round((net * splitPct) / 100);
  const payerShare = Math.max(0, net - payeeShare);

  async function handleResolve(decision: 'release' | 'refund' | 'split') {
    setBusy(true);
    setError(null);
    const splitBps =
      decision === 'split' ? Math.round(splitPct * 100) : null;
    const { error: rpcErr } = await resolveEscrowDisputeRpc(
      dispute.id,
      decision,
      splitBps,
      resolutionNote.trim() || null
    );
    setBusy(false);
    setConfirm(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    setGoodwillError(null);
    if (issueGoodwillOnResolve && goodwillAmount.trim() && esc) {
      const amountCents = Math.round(parseFloat(goodwillAmount) * 100);
      const compensatedId = decision === 'refund' ? esc.payer_id : esc.payee_id;
      if (amountCents > 0 && compensatedId) {
        const client = createClient();
        const { error: gwErr } = await client.rpc('admin_issue_goodwill_credit', {
          p_user_id: compensatedId,
          p_amount_cents: amountCents,
          p_source: 'dispute_resolution',
          p_admin_note: resolutionNote.trim() || `Escrow dispute resolution: ${dispute.id}`,
        });
        if (gwErr) {
          setGoodwillError(
            `Resolution succeeded but goodwill issuance failed: ${gwErr.message}. Retry from the member admin panel.`
          );
          onResolved();
          return;
        }
      }
    }

    setIssueGoodwillOnResolve(false);
    setGoodwillAmount('');
    onResolved();
  }

  if (!esc) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <h4 className="text-[13px] font-extrabold text-foreground">Resolution decision</h4>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {goodwillError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          {goodwillError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          setConfirm({
            decision: 'release',
            title: 'Release funds to payee?',
            message: `${formatNGN(net)} (net) will be credited to ${payeeLabel}'s wallet.`,
          })
        }
        className="w-full rounded-xl border border-border bg-white p-3 text-left transition hover:border-primary/25 hover:bg-[#F8F7FF] disabled:opacity-50"
      >
        <p className="text-[14px] font-extrabold text-foreground">Release to payee</p>
        <p className="mt-0.5 text-[12px] font-semibold text-muted">
          Funds go to {payeeLabel}: {formatNGN(net)}
        </p>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          setConfirm({
            decision: 'refund',
            title: 'Refund full amount?',
            message: `Return ${formatNGN(gross)} to ${payerLabel}'s wallet.`,
          })
        }
        className="w-full rounded-xl border border-red-200/80 bg-red-50 p-3 text-left transition hover:bg-red-100/80 disabled:opacity-50"
      >
        <p className="text-[14px] font-extrabold text-red-700">Full refund to payer</p>
        <p className="mt-0.5 text-[12px] font-semibold text-red-600">
          Return {formatNGN(gross)} to {payerLabel}
        </p>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => setShowSplitInput((v) => !v)}
        className="w-full rounded-xl border border-border bg-white p-3 text-left transition hover:border-primary/25 hover:bg-[#F8F7FF] disabled:opacity-50"
      >
        <p className="text-[14px] font-extrabold text-foreground">Custom split</p>
        <p className="mt-0.5 text-[12px] font-semibold text-muted">Set percentage to each party</p>
      </button>

      {showSplitInput ? (
        <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-extrabold text-amber-800">{payeeLabel} receives</label>
            <input
              type="number"
              min={0}
              max={100}
              value={splitPercent}
              onChange={(e) => setSplitPercent(e.target.value)}
              className="w-16 rounded-lg border border-amber-300 bg-white px-2 py-1 text-center text-[13px] font-semibold"
            />
            <span className="text-[13px] font-extrabold text-amber-800">%</span>
          </div>
          <p className="text-[11px] font-semibold text-amber-800">
            {payeeLabel}: {formatNGN(payeeShare)} · {payerLabel}: {formatNGN(payerShare)}
          </p>
          <AdminPrimaryButton
            className="w-full"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setConfirm({
                decision: 'split',
                title: 'Apply custom split?',
                message: 'Wallet credits will be issued to both parties. This cannot be undone.',
              })
            }
          >
            Apply split
          </AdminPrimaryButton>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <ToggleRow
          label="Also issue goodwill credit"
          checked={issueGoodwillOnResolve}
          onChange={setIssueGoodwillOnResolve}
        />
        {issueGoodwillOnResolve ? (
          <input
            type="number"
            placeholder="Amount (NGN)"
            value={goodwillAmount}
            onChange={(e) => setGoodwillAmount(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
          />
        ) : null}
      </div>

      <textarea
        value={resolutionNote}
        onChange={(e) => setResolutionNote(e.target.value)}
        placeholder="Admin note (optional, not shown to users)"
        rows={2}
        className={cn(
          'w-full resize-none rounded-xl border border-border px-3 py-2 text-[13px] font-semibold',
          'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/25'
        )}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        confirmVariant={confirm?.decision === 'refund' ? 'danger' : 'neutral'}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void handleResolve(confirm.decision);
        }}
      />
    </div>
  );
}
