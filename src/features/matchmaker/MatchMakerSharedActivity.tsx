'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { MatchMakerLayout, MatchMakerPageShell, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPageHeader } from '@/features/matchmaker/MatchMakerPageHeader';
import { MatchMakerSlideIn } from '@/features/matchmaker/MatchMakerSlideIn';
import { isSharedActivityAvailable } from '@/lib/matchmaker/connection';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { getOrCreateConversation } from '@/lib/conversations';
import { partnerUserId } from '@/lib/matchmaker/connection';
import { fetchMatchMakerSharedActivityState } from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const SUNDAY_OPTIONS = [
  'Relaxing at home with a good book',
  'Exploring somewhere new outdoors',
  'Church or community time',
  'Food, friends, and good conversation',
] as const;

export function MatchMakerSharedActivity({ connectionId }: { connectionId: string }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connection, isLoading } = useMatchMakerConnection(connectionId, user?.id);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const partnerId = connection && user?.id ? partnerUserId(connection, user.id) : null;

  const partnerQuery = useQuery({
    queryKey: ['matchmaker-partner', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      return fetchUserProfileBundle(createClient(), partnerId);
    },
    enabled: !!partnerId,
  });

  const activityQuery = useQuery({
    queryKey: ['matchmaker-activity', connectionId],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchMatchMakerSharedActivityState(client, connectionId, 1);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!connectionId,
  });

  const partnerName = partnerQuery.data?.profile?.display_name ?? 'Your match';
  const state = activityQuery.data;
  const unlocked = connection ? isSharedActivityAvailable(connection.connected_at) : false;

  async function submit() {
    if (!answer) return;
    setBusy(true);
    setSubmitError(null);
    const client = createClient();
    const { error } = await client.rpc('matchmaker_submit_activity_answer', {
      p_connection_id: connectionId,
      p_week_number: 1,
      p_answers: { q1: answer },
    });
    setBusy(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['matchmaker-activity', connectionId] });
  }

  async function openChat() {
    if (!user?.id || !partnerId) return;
    const chatId = await getOrCreateConversation(createClient(), user.id, partnerId);
    router.push(`/messages?c=${chatId}`);
  }

  if (isLoading) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell className="animate-pulse">
          <div className="h-48 rounded-3xl bg-[#FBF5F0]" />
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (!connection || !unlocked) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-center text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Shared Activity unlocks on Day 7 of your connection.
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

  return (
    <MatchMakerLayout>
      <MatchMakerSlideIn>
        <MatchMakerPageShell>
          <MatchMakerPageHeader
            kicker="Week 1"
            title="Shared Activity"
            subtitle="Answers are revealed only after you both submit."
            backLabel="Back to connection"
            onBack={() => router.push(`/matchmaker/connection/${connectionId}`)}
          />

          {revealed ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormCard>
                  <p className="text-[12px] font-extrabold uppercase" style={{ color: MATCHMAKER_THEME.textMuted }}>
                    You said
                  </p>
                  <p className="mt-2 text-[15px] font-extrabold">{state?.myAnswer ?? '—'}</p>
                </FormCard>
                <FormCard>
                  <p className="text-[12px] font-extrabold uppercase" style={{ color: MATCHMAKER_THEME.textMuted }}>
                    {partnerName} said
                  </p>
                  <p className="mt-2 text-[15px] font-extrabold">{state?.partnerAnswer ?? '—'}</p>
                </FormCard>
              </div>
              <p className="text-center text-[14px] font-semibold italic" style={{ color: MATCHMAKER_THEME.textMuted }}>
                You have both answered. Talk about it.
              </p>
              <MatchMakerPrimaryButton onClick={() => void openChat()}>Open chat</MatchMakerPrimaryButton>
            </div>
          ) : (
            <>
              <FormCard className="mt-6">
                <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Week 1 · Question 1
                </p>
                <p className="mt-3 text-center text-[18px] font-extrabold leading-snug">
                  What does your ideal Sunday look like?
                </p>
                {!mySubmitted ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {SUNDAY_OPTIONS.map((opt) => (
                      <GradientChip
                        key={opt}
                        label={opt}
                        selected={answer === opt}
                        onClick={() => setAnswer(opt)}
                      />
                    ))}
                  </div>
                ) : null}
              </FormCard>

              <div className="mt-6 space-y-2 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                <p>Your answer: {mySubmitted ? 'submitted' : 'not yet submitted'}</p>
                <p>
                  {partnerName}&apos;s answer:{' '}
                  {partnerSubmitted ? 'submitted' : mySubmitted ? 'still thinking...' : 'waiting for them'}
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
                    disabled={!answer || busy}
                    onClick={() => void submit()}
                    className="mt-6 w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? 'Submitting…' : 'Submit my answer'}
                  </button>
                </>
              ) : (
                <div className="mt-8 space-y-3">
                  <Link
                    href={`/matchmaker/connection/${connectionId}`}
                    className="block text-center text-[14px] font-extrabold underline"
                    style={{ color: MATCHMAKER_THEME.accent }}
                  >
                    Back to connection
                  </Link>
                  <button
                    type="button"
                    onClick={() => void openChat()}
                    className="w-full text-center text-[13px] font-semibold underline"
                    style={{ color: MATCHMAKER_THEME.textMuted }}
                  >
                    Chat while you wait
                  </button>
                </div>
              )}
            </>
          )}
        </MatchMakerPageShell>
      </MatchMakerSlideIn>
    </MatchMakerLayout>
  );
}
