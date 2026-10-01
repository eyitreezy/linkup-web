'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import {
  MatchMakerLayout,
  MatchMakerOutlinedButton,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { fetchMatchMakerGateState, saveMatchMakerHealingAnswers } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const Q1 = ['Too fast', 'About right', 'Too slow', 'Not sure'];
const Q2 = ['Clearer now', 'Unchanged', 'More questions', 'Prefer not to say'];

type Step = 1 | 2 | 3 | 4 | 5 | 'final';

export function MatchMakerHeal() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showDealbreakers, setShowDealbreakers] = useState(false);

  const gateQuery = useQuery({
    queryKey: ['matchmaker-gate', user?.id],
    queryFn: async () => {
      const { data, error } = await fetchMatchMakerGateState(createClient());
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!user?.id,
  });

  const healingDay = gateQuery.data?.healing_day ?? 1;
  const progress = Math.min(100, Math.round((healingDay / 3) * 100));

  const questionCopy = useMemo(() => {
    switch (step) {
      case 1:
        return {
          title: 'After this connection, how do you feel about the pace at which you communicated?',
          options: Q1,
          key: 'q1_pace',
        };
      case 2:
        return {
          title: 'Did your expectations around family goals change or become clearer?',
          options: Q2,
          key: 'q2_family',
        };
      case 3:
        return { title: 'What quality mattered most to you in this connection?', key: 'q3_quality', text: true };
      case 4:
        return {
          title: 'Was there anything you wish you had known about this person earlier?',
          key: 'q4_wish',
          text: true,
        };
      case 5:
        return {
          title: 'What do you want to feel differently in your next connection?',
          key: 'q5_next',
          text: true,
        };
      default:
        return null;
    }
  }, [step]);

  async function persistPartial(patch: Record<string, string>, next: Step) {
    setBusy(true);
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    await saveMatchMakerHealingAnswers(createClient(), merged, {});
    setBusy(false);
    setStep(next);
  }

  async function finish(skipAll: boolean) {
    setBusy(true);
    await saveMatchMakerHealingAnswers(createClient(), answers, { complete: !skipAll, skipAll });
    setBusy(false);
    void queryClient.invalidateQueries({ queryKey: ['matchmaker-gate', user?.id] });
    router.replace('/matchmaker/reentry');
  }

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <h1 className="font-display text-2xl font-extrabold">A moment to refine.</h1>
        <p className="mt-3 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Before you return to MatchMaker, take a moment to update what matters to you.
        </p>

        {step !== 'final' && questionCopy ? (
          <FormCard className="mt-8">
            <p className="text-[15px] font-extrabold leading-snug">{questionCopy.title}</p>
            {'options' in questionCopy && questionCopy.options ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {questionCopy.options.map((opt) => (
                  <GradientChip
                    key={opt}
                    label={opt}
                    selected={answers[questionCopy.key] === opt}
                    onClick={() => setAnswers((a) => ({ ...a, [questionCopy.key]: opt }))}
                  />
                ))}
              </div>
            ) : (
              <input
                value={answers[questionCopy.key] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [questionCopy.key]: e.target.value }))}
                className="mt-4 w-full rounded-2xl border bg-white px-4 py-3 text-[14px] font-semibold"
                style={{ borderColor: MATCHMAKER_THEME.border }}
              />
            )}
            <div className="mt-6 space-y-3">
              <MatchMakerPrimaryButton
                disabled={busy}
                onClick={() => {
                  const key = questionCopy.key;
                  const val = answers[key] ?? '';
                  if (!val.trim() && !('options' in questionCopy)) return;
                  if ('options' in questionCopy && !answers[key]) return;
                  const next = step === 5 ? 'final' : ((step + 1) as Step);
                  void persistPartial({ [key]: answers[key] ?? val }, next);
                }}
              >
                Next
              </MatchMakerPrimaryButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next = step === 5 ? 'final' : ((step + 1) as Step);
                  setStep(next);
                }}
                className="w-full text-[13px] font-semibold underline"
                style={{ color: MATCHMAKER_THEME.textMuted }}
              >
                Skip this question
              </button>
            </div>
          </FormCard>
        ) : (
          <FormCard className="mt-8">
            <p className="text-[15px] font-extrabold">Want to update any dealbreakers or values?</p>
            <div className="mt-4 space-y-3">
              <MatchMakerOutlinedButton onClick={() => setShowDealbreakers((v) => !v)}>
                {showDealbreakers ? 'Hide dealbreakers' : 'Update dealbreakers'}
              </MatchMakerOutlinedButton>
              {showDealbreakers ? (
                <p className="text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Use MatchMaker values setup to edit dealbreakers when you are ready.
                </p>
              ) : null}
              <MatchMakerOutlinedButton onClick={() => router.push('/matchmaker/values')}>
                Update values
              </MatchMakerOutlinedButton>
            </div>
            <div className="mt-6 space-y-3">
              <MatchMakerPrimaryButton disabled={busy} onClick={() => void finish(false)}>
                Save and finish
              </MatchMakerPrimaryButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish(true)}
                className="w-full text-[13px] font-semibold underline"
                style={{ color: MATCHMAKER_THEME.textMuted }}
              >
                Skip all, I will update later
              </button>
            </div>
          </FormCard>
        )}

        <div className="mt-10">
          <p className="text-[13px] font-extrabold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Healing period · Day {healingDay} of 3
          </p>
          <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full" style={{ background: MATCHMAKER_THEME.border }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: MATCHMAKER_THEME.primary }} />
          </div>
        </div>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
