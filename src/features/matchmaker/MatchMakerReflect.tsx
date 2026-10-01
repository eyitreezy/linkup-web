'use client';

import { FormCard } from '@/components/settings/FormCard';
import {
  MatchMakerLayout,
  MatchMakerOutlinedButton,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { fetchMatchMakerGateState, saveMatchMakerReflectionPeriod } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function MatchMakerReflect() {
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const gateQuery = useQuery({
    queryKey: ['matchmaker-gate', user?.id],
    queryFn: async () => {
      const { data, error } = await fetchMatchMakerGateState(createClient());
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!user?.id,
  });

  const reflectionDay = gateQuery.data?.reflection_day ?? 1;
  const daysUntilPool = gateQuery.data?.days_until_pool ?? 0;
  const progress = Math.min(100, Math.round((reflectionDay / 3) * 100));

  async function save(skip: boolean) {
    setBusy(true);
    const { error } = await saveMatchMakerReflectionPeriod(createClient(), text.trim(), skip);
    setBusy(false);
    if (!error) setSaved(true);
  }

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="py-12 text-center">
        <MatchMakerTabIcon size={40} className="mx-auto text-[#9B1B4B]/60" />
        <h1 className="mt-6 font-display text-2xl font-extrabold">Take a moment.</h1>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Reflect on what you experienced. We will be here when you are ready.
        </p>

        <FormCard className="mt-8 text-left">
          <p className="text-[14px] font-extrabold">What did you learn from this connection?</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Private to you"
            className="mt-3 min-h-[120px] w-full rounded-2xl border bg-white p-4 text-[14px] font-semibold"
            style={{ borderColor: MATCHMAKER_THEME.border }}
          />
          <div className="mt-4 space-y-3">
            <MatchMakerPrimaryButton disabled={busy || !text.trim()} onClick={() => void save(false)}>
              {busy ? 'Saving…' : 'Save privately'}
            </MatchMakerPrimaryButton>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="w-full text-[13px] font-semibold underline"
              style={{ color: MATCHMAKER_THEME.textMuted }}
            >
              Skip
            </button>
          </div>
          {saved ? (
            <p className="mt-3 text-[12px] font-semibold text-[#9B1B4B]">Saved privately.</p>
          ) : null}
        </FormCard>

        <div className="mt-10">
          <p className="text-[13px] font-extrabold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Reflection period · Day {reflectionDay} of 3
          </p>
          <div
            className="mx-auto mt-2 h-1.5 max-w-xs overflow-hidden rounded-full"
            style={{ background: MATCHMAKER_THEME.border }}
          >
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: MATCHMAKER_THEME.accent }} />
          </div>
        </div>

        <p className="mt-8 text-[13px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Your MatchMaker discovery pool resumes in {daysUntilPool} days. All other LinkUp features are available as
          normal.
        </p>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
