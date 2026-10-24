'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import {
  MatchMakerLayout,
  MatchMakerOutlinedButton,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPageHeader } from '@/features/matchmaker/MatchMakerPageHeader';
import { MatchMakerSlideIn } from '@/features/matchmaker/MatchMakerSlideIn';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { getOrCreateConversation } from '@/lib/conversations';
import { partnerUserId } from '@/lib/matchmaker/connection';
import { sharedActivityWeekDefinition } from '@/lib/matchmaker/sharedActivityCatalog';
import {
  buildSharedActivityAnswerPayload,
  canSubmitSharedActivityAnswer,
  formatSharedActivityAnswerDisplay,
  sanitizeSharedActivityCustomInput,
  SHARED_ACTIVITY_OTHER_LABEL,
  SHARED_ACTIVITY_OTHER_SELECTION,
} from '@/lib/matchmaker/sharedActivityAnswer';
import { isActivityWeekUnlocked, maxUnlockedActivityWeek } from '@/lib/matchmaker/sharedActivityWeek';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { fetchMatchMakerSharedActivityState } from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function ConcealedPartnerAnswerPreview({ partnerName }: { partnerName: string }) {
  return (
    <FormCard className="mt-4">
      <p className="text-[13px] font-extrabold" style={{ color: MATCHMAKER_THEME.accent }}>
        {partnerName} shared their answer
      </p>
      <p className="mt-1 text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
        Submit yours to unlock both answers. Their text stays hidden until then.
      </p>
      <div
        className="relative mt-4 overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: MATCHMAKER_THEME.border }}
      >
        <div className="space-y-3 p-5 blur-md select-none" aria-hidden>
          <div className="h-3 w-4/5 rounded-full bg-[#EDE0D4]/80" />
          <div className="h-3 w-full rounded-full bg-[#EDE0D4]/60" />
          <div className="h-3 w-2/3 rounded-full bg-[#EDE0D4]/70" />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#FDF8F4]/40 px-4">
          <p className="text-center text-[13px] font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
            Answer concealed
          </p>
        </div>
      </div>
    </FormCard>
  );
}

type Props = {
  connectionId: string;
  weekNumber: number;
};

export function MatchMakerSharedActivity({ connectionId, weekNumber }: Props) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connection, isLoading } = useMatchMakerConnection(connectionId, user?.id);
  const [selection, setSelection] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const weekDef = sharedActivityWeekDefinition(weekNumber);
  const partnerId = connection && user?.id ? partnerUserId(connection, user.id) : null;

  const unlocked = connection
    ? isActivityWeekUnlocked(connection.connected_at, weekNumber)
    : false;

  const maxWeek = connection ? maxUnlockedActivityWeek(connection.connected_at) : 0;
  const nextWeek = weekNumber < maxWeek ? weekNumber + 1 : null;

  const partnerQuery = useQuery({
    queryKey: ['matchmaker-partner', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      return fetchUserProfileBundle(createClient(), partnerId);
    },
    enabled: !!partnerId,
  });

  const activityQuery = useQuery({
    queryKey: ['matchmaker-activity', connectionId, weekNumber],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchMatchMakerSharedActivityState(client, connectionId, weekNumber);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!connectionId && unlocked,
  });

  const partnerName = partnerQuery.data?.profile?.display_name ?? 'Your match';
  const state = activityQuery.data;
  const canSubmit = canSubmitSharedActivityAnswer(selection, customAnswer);

  const presetOptions = useMemo(() => weekDef?.presets ?? [], [weekDef]);

  async function submit() {
    const built = buildSharedActivityAnswerPayload(selection, customAnswer);
    if (!built.ok) {
      setSubmitError(built.error);
      return;
    }
    setBusy(true);
    setSubmitError(null);
    const client = createClient();
    const { error } = await client.rpc('matchmaker_submit_activity_answer', {
      p_connection_id: connectionId,
      p_week_number: weekNumber,
      p_answers: { q1: built.q1 },
    });
    setBusy(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['matchmaker-activity', connectionId] });
    void queryClient.invalidateQueries({ queryKey: ['matchmaker-activity-overview', connectionId] });
  }

  async function openChat() {
    if (!user?.id || !partnerId) return;
    const chatId = await getOrCreateConversation(createClient(), user.id, partnerId);
    router.push(`/messages?c=${chatId}`);
  }

  if (isLoading || (unlocked && activityQuery.isLoading)) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell className="animate-pulse">
          <div className="h-48 rounded-3xl bg-[#FBF5F0]" />
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (activityQuery.isError) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-[14px] font-semibold text-[#EF4444]">Could not load Shared Activity.</p>
          <button
            type="button"
            onClick={() => void activityQuery.refetch()}
            className="mt-4 min-h-[44px] rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white"
          >
            Retry
          </button>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (!connection || !unlocked || !weekDef) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-center text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Shared Activity unlocks on Day 7 of your connection, with a new question each week.
          </p>
          <Link
            href={`/matchmaker/connection/${connectionId}`}
            className="mt-6 block text-center text-[14px] font-extrabold underline"
            style={{ color: MATCHMAKER_THEME.accent }}
          >
            Back to connection
          </Link>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  const revealed = state?.revealed;
  const mySubmitted = state?.mySubmitted;
  const partnerSubmitted = state?.partnerSubmitted;
  const showConcealedPreview = partnerSubmitted && !mySubmitted && !revealed;

  return (
    <MatchMakerLayout>
      <MatchMakerSlideIn>
        <MatchMakerPageShell>
          <MatchMakerPageHeader
            kicker={`Week ${weekNumber}`}
            title="Shared Activity"
            subtitle="Answers are revealed only after you both submit."
            showBrandIcon
            backLabel="Back to connection"
            onBack={() => router.push(`/matchmaker/connection/${connectionId}`)}
          />

          {maxWeek > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
                <Link
                  key={w}
                  href={`/matchmaker/connection/${connectionId}/activity?week=${w}`}
                  className={cn(
                    'rounded-full px-3 py-1 text-[12px] font-extrabold',
                    w === weekNumber ? 'linkup-gradient-primary text-white' : 'border bg-white'
                  )}
                  style={w === weekNumber ? undefined : { borderColor: MATCHMAKER_THEME.border }}
                >
                  Week {w}
                </Link>
              ))}
            </div>
          ) : null}

          {revealed ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormCard>
                  <p className="text-[12px] font-extrabold uppercase" style={{ color: MATCHMAKER_THEME.textMuted }}>
                    You said
                  </p>
                  <p className="mt-2 text-[15px] font-extrabold">
                    {formatSharedActivityAnswerDisplay(state?.myAnswer)}
                  </p>
                </FormCard>
                <FormCard>
                  <p className="text-[12px] font-extrabold uppercase" style={{ color: MATCHMAKER_THEME.textMuted }}>
                    {partnerName} said
                  </p>
                  <p className="mt-2 text-[15px] font-extrabold">
                    {formatSharedActivityAnswerDisplay(state?.partnerAnswer)}
                  </p>
                </FormCard>
              </div>
              <p className="text-center text-[14px] font-semibold italic" style={{ color: MATCHMAKER_THEME.textMuted }}>
                You have both answered. Talk about it.
              </p>
              <MatchMakerPrimaryButton onClick={() => void openChat()}>Open chat</MatchMakerPrimaryButton>
              {nextWeek ? (
                <Link
                  href={`/matchmaker/connection/${connectionId}/activity?week=${nextWeek}`}
                  className="block text-center text-[14px] font-extrabold underline"
                  style={{ color: MATCHMAKER_THEME.accent }}
                >
                  See next question
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              {showConcealedPreview ? <ConcealedPartnerAnswerPreview partnerName={partnerName} /> : null}

              <FormCard className="mt-6">
                <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Week {weekNumber} · Question {weekDef.questionNumber}
                </p>
                <p className="mt-3 text-center text-[18px] font-extrabold leading-snug">{weekDef.question}</p>
                {!mySubmitted ? (
                  <>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {presetOptions.map((opt) => (
                        <GradientChip
                          key={opt}
                          label={opt}
                          selected={selection === opt}
                          onClick={() => {
                            setSelection(opt);
                            setCustomAnswer('');
                            setSubmitError(null);
                          }}
                        />
                      ))}
                      <GradientChip
                        label={SHARED_ACTIVITY_OTHER_LABEL}
                        selected={selection === SHARED_ACTIVITY_OTHER_SELECTION}
                        onClick={() => {
                          setSelection(SHARED_ACTIVITY_OTHER_SELECTION);
                          setSubmitError(null);
                        }}
                      />
                    </div>
                    {selection === SHARED_ACTIVITY_OTHER_SELECTION ? (
                      <div className="mt-4 space-y-1">
                        <label className="block text-[12px] font-extrabold text-muted">Your answer</label>
                        <input
                          type="text"
                          value={customAnswer}
                          maxLength={100}
                          onChange={(e) => setCustomAnswer(sanitizeSharedActivityCustomInput(e.target.value))}
                          placeholder="Your answer"
                          className={cn(
                            'w-full rounded-xl border px-4 py-3 text-[14px] font-semibold',
                            'border-[#D8DCE6] bg-white focus:outline-none focus:ring-2 focus:ring-primary/30'
                          )}
                          aria-describedby="shared-activity-other-count"
                        />
                        <p id="shared-activity-other-count" className="text-right text-[11px] font-semibold text-muted">
                          {customAnswer.length}/100
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </FormCard>

              <div className="mt-6 space-y-2 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                <p>Your answer: {mySubmitted ? 'submitted' : 'not yet submitted'}</p>
                <p>
                  {partnerName}&apos;s answer:{' '}
                  {partnerSubmitted
                    ? mySubmitted
                      ? 'submitted'
                      : 'waiting for your answer'
                    : mySubmitted
                      ? 'still thinking...'
                      : 'waiting for them'}
                </p>
              </div>

              {mySubmitted && !partnerSubmitted ? (
                <p className="mt-4 text-center text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  We will reveal both answers the moment {partnerName} submits theirs.
                </p>
              ) : null}

              {!mySubmitted ? (
                <>
                  {submitError ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{submitError}</p> : null}
                  <button
                    type="button"
                    disabled={!canSubmit || busy}
                    onClick={() => void submit()}
                    className="mt-6 w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? 'Submitting…' : 'Submit my answer'}
                  </button>
                </>
              ) : (
                <div className={cn('mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2')}>
                  <MatchMakerOutlinedButton
                    className="w-full sm:min-h-[48px]"
                    onClick={() => router.push(`/matchmaker/connection/${connectionId}`)}
                  >
                    Back to connection
                  </MatchMakerOutlinedButton>
                  <MatchMakerPrimaryButton className="w-full sm:min-h-[48px]" onClick={() => void openChat()}>
                    Chat while you wait
                  </MatchMakerPrimaryButton>
                </div>
              )}
            </>
          )}
        </MatchMakerPageShell>
      </MatchMakerSlideIn>
    </MatchMakerLayout>
  );
}
