'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import {
  MatchMakerAccentButton,
  MatchMakerLayout,
  MatchMakerOutlinedButton,
  MatchMakerPageShell,
} from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { onboardingFieldClass } from '@/lib/onboarding/formFieldClass';
import {
  buildMatchMakerEndReasonPayload,
  canSubmitMatchMakerEndReason,
  MATCHMAKER_END_REASON_OTHER,
  sanitizeOtherEndReasonInput,
} from '@/lib/matchmaker/endConnectionReason';
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
  const [otherReason, setOtherReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEnd = canSubmitMatchMakerEndReason(reason, otherReason);

  async function confirmEnd() {
    if (!reason) return;
    const built = buildMatchMakerEndReasonPayload(reason, otherReason);
    if (!built.ok) {
      setError(built.error);
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    const { error: endError } = await endMatchMakerConnection(createClient(), connectionId, built.reason);
    setBusy(false);
    if (endError) {
      setError(endError);
      setConfirmOpen(false);
      return;
    }
    router.replace('/matchmaker');
  }

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
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
                onClick={() => {
                  setReason(r);
                  if (r !== MATCHMAKER_END_REASON_OTHER) setOtherReason('');
                  setError(null);
                }}
              />
            ))}
          </div>
          {reason === MATCHMAKER_END_REASON_OTHER ? (
            <div className="mt-4 space-y-1">
              <label className="block text-[12px] font-extrabold text-muted">Please enter your reason</label>
              <input
                type="text"
                value={otherReason}
                maxLength={40}
                onChange={(e) => setOtherReason(sanitizeOtherEndReasonInput(e.target.value))}
                placeholder="Your reason (private)"
                className={onboardingFieldClass}
                aria-describedby="mm-end-other-count-flow"
              />
              <p id="mm-end-other-count-flow" className="text-right text-[11px] font-semibold text-muted">
                {otherReason.length}/40
              </p>
            </div>
          ) : null}
        </FormCard>

        {error ? <p className="mt-4 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <div className="mt-8 space-y-3">
          <MatchMakerAccentButton disabled={!canEnd || busy} onClick={() => setConfirmOpen(true)}>
            End connection
          </MatchMakerAccentButton>
          <MatchMakerOutlinedButton onClick={() => router.back()}>Keep this connection</MatchMakerOutlinedButton>
        </div>
      </MatchMakerPageShell>

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
