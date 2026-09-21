'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { MatchMakerLayout } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { endMatchMakerConnection } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const REASONS = [
  'Not compatible',
  'Moving too slowly',
  'Not feeling it',
  'Personal reasons',
  'Other',
] as const;

export function MatchMakerEndFlow({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmEnd() {
    if (!reason) return;
    setBusy(true);
    const { error: endError } = await endMatchMakerConnection(createClient(), connectionId, reason);
    setBusy(false);
    if (endError) {
      setError(endError);
      setConfirmOpen(false);
      return;
    }
    router.replace('/matchmaker/reflect');
  }

  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-lg px-4 py-10">
        <FormCard>
          <h1 className="font-display text-2xl font-extrabold">End this connection?</h1>
          <p className="mt-3 text-[13px] font-semibold text-muted">
            This cannot be undone. No reason will be shared with the other person.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <GradientChip
                key={r}
                label={r}
                selected={reason === r}
                onClick={() => setReason(r)}
              />
            ))}
          </div>
        </FormCard>

        {error ? <p className="mt-4 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <div className="mt-8 space-y-3">
          <button
            type="button"
            disabled={!reason || busy}
            onClick={() => setConfirmOpen(true)}
            className="w-full min-h-[48px] rounded-full text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            style={{ background: MATCHMAKER_THEME.accent }}
          >
            End connection
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full text-center text-[14px] font-semibold underline"
            style={{ color: MATCHMAKER_THEME.textMuted }}
          >
            Go back
          </button>
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
    </MatchMakerLayout>
  );
}
