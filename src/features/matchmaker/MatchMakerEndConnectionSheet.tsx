'use client';

import { GradientChip } from '@/components/settings/GradientChip';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { MatchMakerAccentButton, MatchMakerOutlinedButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { endMatchMakerConnection } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoClose } from 'react-icons/io5';

const REASONS = [
  'Not compatible',
  'Moving too slowly',
  'Not feeling it',
  'Personal reasons',
  'Other',
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  connectionId: string;
  partnerName: string;
};

export function MatchMakerEndConnectionSheet({ open, onClose, connectionId, partnerName }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function confirmEnd() {
    if (!reason) return;
    setBusy(true);
    const { error: endError } = await endMatchMakerConnection(createClient(), connectionId, reason);
    setBusy(false);
    setConfirmOpen(false);
    if (endError) {
      setError(endError);
      return;
    }
    onClose();
    router.replace('/matchmaker');
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
        <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
        <div
          className="relative w-full max-w-lg rounded-t-3xl border p-5 shadow-xl sm:rounded-3xl duration-300"
          style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.background }}
          role="dialog"
          aria-labelledby="mm-end-sheet-title"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full sm:hidden" style={{ background: MATCHMAKER_THEME.border }} />
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="mm-end-sheet-title" className="font-display text-xl font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
              End your connection with {partnerName}?
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2"
              style={{ color: MATCHMAKER_THEME.textMuted }}
              aria-label="Close"
            >
              <IoClose size={22} />
            </button>
          </div>
          <p className="text-[13px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
            This cannot be undone. {partnerName} will be notified that this connection has ended. No reason will be
            shared with them.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <GradientChip key={r} label={r} selected={reason === r} onClick={() => setReason(r)} />
            ))}
          </div>
          {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
          <div className="mt-6">
            <MatchMakerAccentButton disabled={!reason || busy} onClick={() => setConfirmOpen(true)}>
              End connection
            </MatchMakerAccentButton>
          </div>
          <div className="mt-4">
            <MatchMakerOutlinedButton onClick={onClose}>Keep this connection</MatchMakerOutlinedButton>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="End connection?"
        message="This cannot be undone."
        confirmLabel={busy ? 'Ending…' : 'End connection'}
        cancelLabel="Keep connection"
        confirmVariant="danger"
        onConfirm={() => void confirmEnd()}
        onClose={() => setConfirmOpen(false)}
        busy={busy}
      />
    </>
  );
}
