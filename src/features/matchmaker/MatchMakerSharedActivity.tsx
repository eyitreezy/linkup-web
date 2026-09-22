'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const SUNDAY_OPTIONS = [
  'Relaxing at home with a good book',
  'Exploring somewhere new outdoors',
  'Church or community time',
  'Food, friends, and good conversation',
] as const;

export function MatchMakerSharedActivity({ connectionId }: { connectionId: string }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function submit() {
    if (!answer) return;
    setBusy(true);
    const client = createClient();
    const { data, error } = await client.rpc('matchmaker_submit_activity_answer', {
      p_connection_id: connectionId,
      p_week_number: 1,
      p_answers: { q1: answer },
    });
    setBusy(false);
    if (error) return;
    const payload = data as { revealed?: boolean };
    if (payload.revealed) setRevealed(true);
  }

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <h1 className="font-display text-2xl font-extrabold">Shared Activity</h1>
        <p className="mt-2 text-[13px] font-semibold text-muted">
          Answers are revealed only after you both submit.
        </p>

        {!revealed ? (
          <FormCard className="mt-6">
            <p className="text-[15px] font-extrabold">What does your ideal Sunday look like?</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUNDAY_OPTIONS.map((opt) => (
                <GradientChip
                  key={opt}
                  label={opt}
                  selected={answer === opt}
                  onClick={() => setAnswer(opt)}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!answer || busy}
              onClick={() => void submit()}
              className="mt-6 w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit my answer'}
            </button>
          </FormCard>
        ) : (
          <p className="mt-8 text-[15px] font-semibold text-[#9B1B4B]">
            Both answers submitted. See what you both said.
          </p>
        )}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
