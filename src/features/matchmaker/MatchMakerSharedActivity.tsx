'use client';

import { MatchMakerLayout, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export function MatchMakerSharedActivity({ connectionId }: { connectionId: string }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function submit() {
    setBusy(true);
    const client = createClient();
    const { data, error } = await client.rpc('matchmaker_submit_activity_answer', {
      p_connection_id: connectionId,
      p_week_number: 1,
      p_answers: { q1: answer.trim() },
    });
    setBusy(false);
    if (error) return;
    const payload = data as { revealed?: boolean };
    if (payload.revealed) setRevealed(true);
  }

  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold">Shared Activity</h1>
        <p className="mt-2 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Answers are revealed only after you both submit.
        </p>
        {!revealed ? (
          <>
            <p className="mt-6 text-[15px] font-extrabold">What does your ideal Sunday look like?</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="mt-3 min-h-[120px] w-full rounded-2xl border p-4 text-[14px] font-semibold"
              style={{ borderColor: MATCHMAKER_THEME.border }}
            />
            <div className="mt-6">
              <MatchMakerPrimaryButton disabled={!answer.trim() || busy} onClick={() => void submit()}>
                {busy ? 'Submitting…' : 'Submit answer'}
              </MatchMakerPrimaryButton>
            </div>
          </>
        ) : (
          <p className="mt-8 text-[15px] font-semibold text-[#9B1B4B]">
            Both answers submitted — revealed in chat and notifications.
          </p>
        )}
      </div>
    </MatchMakerLayout>
  );
}
