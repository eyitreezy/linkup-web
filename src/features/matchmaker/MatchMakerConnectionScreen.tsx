'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { MatchMakerDay10CheckinCard } from '@/features/matchmaker/MatchMakerDay10CheckinCard';
import { MatchMakerConnectionTimeline } from '@/features/matchmaker/MatchMakerConnectionTimeline';
import { MatchMakerEndConnectionSheet } from '@/features/matchmaker/MatchMakerEndConnectionSheet';
import {
  MatchMakerCard,
  MatchMakerLayout,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPageHeader } from '@/features/matchmaker/MatchMakerPageHeader';
import { MatchMakerPoolCardSignals } from '@/features/matchmaker/MatchMakerPoolCardParts';
import { MatchMakerPostMeetupFlow } from '@/features/matchmaker/MatchMakerPostMeetupFlow';
import { MatchMakerSlideIn } from '@/features/matchmaker/MatchMakerSlideIn';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import {
  connectionDayNumber,
  isPlanWindowOpen,
  isReadyToMeetAvailable,
  isSharedActivityAvailable,
  partnerUserId,
  planWindowDaysRemaining,
} from '@/lib/matchmaker/connection';
import { buildConnectionMilestones, lockedFeatureUnlockDay } from '@/lib/matchmaker/connectionTimeline';
import {
  isDay10CheckinDismissed,
  shouldRenderDay10CheckinCard,
} from '@/lib/matchmaker/day10Checkin';
import { profileDistanceLabel } from '@/lib/matchmaker/profileView';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { getOrCreateConversation } from '@/lib/conversations';
import {
  fetchLastMessageTimesForConversation,
  fetchMatchMakerConversationId,
  fetchMatchMakerSharedActivityState,
  hasReadySignal,
  sendReadyToMeetSignal,
  shouldShowPostMeetupPrompt,
} from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';

function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age > 0 ? age : null;
}

export function MatchMakerConnectionScreen({ connectionId }: { connectionId: string }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { connection, isLoading, error } = useMatchMakerConnection(connectionId, user?.id);
  const [readySent, setReadySent] = useState(false);
  const [readyConfirmOpen, setReadyConfirmOpen] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [day10Visible, setDay10Visible] = useState(true);
  const [postMeetupOpen, setPostMeetupOpen] = useState(false);
  const [postMeetupDismissed, setPostMeetupDismissed] = useState(false);

  const partnerId = connection && user?.id ? partnerUserId(connection, user.id) : null;

  const partnerQuery = useQuery({
    queryKey: ['matchmaker-partner', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      return fetchUserProfileBundle(createClient(), partnerId);
    },
    enabled: !!partnerId,
  });

  const viewerQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const activityQuery = useQuery({
    queryKey: ['matchmaker-activity', connectionId],
    queryFn: async () => {
      const client = createClient();
      const { data, error: actErr } = await fetchMatchMakerSharedActivityState(client, connectionId, 1);
      if (actErr) throw new Error(actErr);
      return data;
    },
    enabled: !!connectionId,
  });

  const messageTimesQuery = useQuery({
    queryKey: ['matchmaker-msg-times', connectionId, user?.id, partnerId],
    queryFn: async () => {
      if (!user?.id || !partnerId) return null;
      const client = createClient();
      const convoId =
        (await fetchMatchMakerConversationId(client, connectionId)) ??
        (await getOrCreateConversation(client, user.id, partnerId));
      return fetchLastMessageTimesForConversation(client, convoId, user.id, partnerId);
    },
    enabled: !!connectionId && !!user?.id && !!partnerId,
  });

  useEffect(() => {
    if (!connectionId || !user?.id) return;
    void hasReadySignal(createClient(), connectionId, user.id).then(setReadySent);
  }, [connectionId, user?.id]);

  useEffect(() => {
    if (!connectionId || postMeetupDismissed) return;
    void shouldShowPostMeetupPrompt(createClient(), connectionId, user?.id ?? '').then((show) => {
      if (show) setPostMeetupOpen(true);
    });
  }, [connectionId, user?.id, postMeetupDismissed]);

  useEffect(() => {
    if (connection?.status === 'ended') {
      router.replace('/matchmaker/reflect');
    }
  }, [connection?.status, router]);

  function showUnlockToast(feature: 'shared_activity' | 'ready_to_meet' | 'plan_window') {
    if (!connection) return;
    const day = lockedFeatureUnlockDay(feature, connection);
    setActionToast(day ? `This unlocks on Day ${day}.` : 'Not available yet.');
    window.setTimeout(() => setActionToast(null), 2200);
  }

  async function openChat() {
    if (!user?.id || !partnerId) return;
    const client = createClient();
    const chatId = await getOrCreateConversation(client, user.id, partnerId);
    router.push(`/messages?c=${chatId}`);
  }

  async function confirmReadySignal() {
    setReadyBusy(true);
    const { error: rpcError } = await sendReadyToMeetSignal(createClient(), connectionId);
    setReadyBusy(false);
    setReadyConfirmOpen(false);
    if (!rpcError) setReadySent(true);
  }

  const partner = partnerQuery.data?.profile;
  const partnerName = partner?.display_name ?? 'Your match';
  const age = ageFromBirthDate(partner?.birth_date);

  const signals = useMemo(() => {
    const viewer = viewerQuery.data?.profile;
    if (!viewer || !partner) return [];
    return buildCompatibilitySignals(
      { communication_style: viewer.communication_style, preferences: viewer.preferences },
      {
        user_id: partnerId!,
        display_name: partner.display_name,
        birth_date: partner.birth_date ?? null,
        communication_style: partner.communication_style,
        preferences: partner.preferences,
        location_label: partner.location_label,
      }
    );
  }, [viewerQuery.data?.profile, partner]);

  const locationLabel =
    partner && viewerQuery.data?.profile
      ? profileDistanceLabel(viewerQuery.data.profile, partner) ?? partner.location_label
      : partner?.location_label;

  if (isLoading) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell className="animate-pulse">
          <div className="h-64 rounded-3xl bg-[#FBF5F0]" />
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (error || !connection) {
    return (
      <MatchMakerLayout>
        <p className="p-6 text-center text-[14px] font-semibold text-[#EF4444]">
          {error instanceof Error ? error.message : 'Connection not found'}
        </p>
      </MatchMakerLayout>
    );
  }

  const day = connectionDayNumber(connection.connected_at);
  const planDaysLeft = planWindowDaysRemaining(connection.plan_unlock_at);
  const planOpen = isPlanWindowOpen(connection);
  const sharedActivityReady = isSharedActivityAvailable(connection.connected_at);
  const readyAvailable = isReadyToMeetAvailable(connection.connected_at);
  const activityRevealed = !!activityQuery.data?.revealed;
  const milestones = buildConnectionMilestones(connection, { sharedActivityDone: activityRevealed });

  const showDay10 =
    day10Visible &&
    !isDay10CheckinDismissed(connection.id) &&
    shouldRenderDay10CheckinCard(connection, {
      partnerLastMessageAt: messageTimesQuery.data?.partnerLast ?? null,
      viewerLastMessageAt: messageTimesQuery.data?.viewerLast ?? null,
    });

  return (
    <MatchMakerLayout>
      <MatchMakerSlideIn>
        <MatchMakerPageShell>
          <MatchMakerPageHeader
            kicker="MatchMaker"
            title={partnerName}
            subtitle="Your active connection"
            backLabel="Back to MatchMaker"
            onBack={() => router.push('/matchmaker')}
            actions={
              <Link
                href="/settings"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/90 shadow-sm"
                style={{ borderColor: `${MATCHMAKER_THEME.accent}33`, color: MATCHMAKER_THEME.textMuted }}
                aria-label="Settings"
              >
                <IoSettingsOutline size={22} />
              </Link>
            }
          />

          {connection.status === 'paused' ? (
            <div
              className="mb-4 rounded-2xl border px-4 py-3 text-[13px] font-semibold"
              style={{ borderColor: '#F59E0B', background: '#FFFBEB', color: '#92400E' }}
            >
              This connection is paused while a subscription issue is resolved.
            </div>
          ) : null}

          {showDay10 ? (
            <MatchMakerDay10CheckinCard
              connection={connection}
              partnerName={partnerName}
              partnerLastMessageAt={messageTimesQuery.data?.partnerLast ?? null}
              viewerLastMessageAt={messageTimesQuery.data?.viewerLast ?? null}
              onDismiss={() => setDay10Visible(false)}
              onCopyStarter={(text) => {
                void navigator.clipboard?.writeText(text);
                setActionToast('Copied. Paste it in chat.');
                window.setTimeout(() => setActionToast(null), 2000);
              }}
            />
          ) : null}

          <div className="mt-4 flex flex-col items-center text-center">
            <ProfileAvatar
              profile={partner}
              displayName={partner?.display_name}
              size={88}
              ringClassName="ring-2 ring-[#9B1B4B]/40"
            />
            <h2 className="mt-4 font-display text-2xl font-extrabold">
              {partnerName}
              {age ? ` · ${age}` : ''}
            </h2>
            {locationLabel ? (
              <p className="mt-1 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                {locationLabel}
              </p>
            ) : null}
          </div>

          <MatchMakerCard className="mt-6">
            <p className="text-[14px] font-extrabold text-[#9B1B4B]">Connected, Day {day}</p>
            {!connection.first_message_at ? (
              <p className="mt-1 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                Send the first message to start your 21-day plan window.
              </p>
            ) : planOpen ? (
              <p className="mt-1 text-[14px] font-semibold text-[#9B1B4B]">Plan window is open</p>
            ) : (
              <p className="mt-1 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                Plan window opens in {planDaysLeft ?? 0} days
              </p>
            )}
          </MatchMakerCard>

          {signals.length > 0 ? (
            <div className="mt-4">
              <MatchMakerPoolCardSignals signals={signals} />
            </div>
          ) : null}

          <MatchMakerCard className="mt-6">
            <p className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Journey
            </p>
            <MatchMakerConnectionTimeline milestones={milestones} />
          </MatchMakerCard>

          <div className="mt-6 space-y-3">
            <MatchMakerPrimaryButton onClick={() => void openChat()}>Open Chat</MatchMakerPrimaryButton>

            {sharedActivityReady ? (
              <Link
                href={`/matchmaker/connection/${connectionId}/activity`}
                className="flex min-h-[48px] items-center justify-center rounded-full border font-extrabold"
                style={{ borderColor: MATCHMAKER_THEME.border }}
              >
                Shared Activity
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => showUnlockToast('shared_activity')}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full border font-extrabold opacity-60"
                style={{ borderColor: MATCHMAKER_THEME.border, color: MATCHMAKER_THEME.disabled }}
              >
                Shared Activity
              </button>
            )}

            {readyAvailable && !readySent ? (
              <button
                type="button"
                onClick={() => setReadyConfirmOpen(true)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full border font-extrabold"
                style={{ borderColor: MATCHMAKER_THEME.accent, color: MATCHMAKER_THEME.accent }}
              >
                I feel ready to meet
              </button>
            ) : readyAvailable ? null : (
              <button
                type="button"
                onClick={() => showUnlockToast('ready_to_meet')}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full border font-extrabold opacity-60"
                style={{ borderColor: MATCHMAKER_THEME.border, color: MATCHMAKER_THEME.disabled }}
              >
                I feel ready to meet
              </button>
            )}

            {planOpen ? (
              <Link
                href={`/plan/create?matchmakerConnectionId=${connectionId}`}
                className="flex min-h-[48px] items-center justify-center rounded-full font-extrabold text-white shadow-md"
                style={{ background: MATCHMAKER_THEME.ctaGradient }}
              >
                Create Plan
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => showUnlockToast('plan_window')}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full font-extrabold"
                style={{ background: MATCHMAKER_THEME.disabled, color: '#fff' }}
              >
                Create Plan
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setEndOpen(true)}
            className="mt-8 block w-full text-center text-[13px] font-semibold underline"
            style={{ color: MATCHMAKER_THEME.textMuted }}
          >
            End this connection
          </button>

          {actionToast ? (
            <p
              className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-extrabold text-white shadow-lg"
              style={{ background: MATCHMAKER_THEME.accent }}
            >
              {actionToast}
            </p>
          ) : null}
        </MatchMakerPageShell>
      </MatchMakerSlideIn>

      <ConfirmDialog
        open={readyConfirmOpen}
        title="Send readiness signal?"
        message={`Send a readiness signal to ${partnerName}? They will receive a notification only.`}
        confirmLabel={readyBusy ? 'Sending…' : 'Send signal'}
        cancelLabel="Cancel"
        onConfirm={() => void confirmReadySignal()}
        onClose={() => setReadyConfirmOpen(false)}
        busy={readyBusy}
      />

      <MatchMakerEndConnectionSheet
        open={endOpen}
        onClose={() => setEndOpen(false)}
        connectionId={connectionId}
        partnerName={partnerName}
      />

      {postMeetupOpen ? (
        <MatchMakerPostMeetupFlow
          connectionId={connectionId}
          partnerName={partnerName}
          onDismiss={() => {
            setPostMeetupOpen(false);
            setPostMeetupDismissed(true);
          }}
          onChooseEnd={() => setEndOpen(true)}
        />
      ) : null}
    </MatchMakerLayout>
  );
}
