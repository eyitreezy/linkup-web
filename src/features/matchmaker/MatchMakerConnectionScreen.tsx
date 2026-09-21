'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import {
  MatchMakerCard,
  MatchMakerLayout,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import {
  connectionDayNumber,
  isPlanWindowOpen,
  isReadyToMeetAvailable,
  isSharedActivityAvailable,
  partnerUserId,
  planWindowDaysRemaining,
} from '@/lib/matchmaker/connection';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { getOrCreateConversation } from '@/lib/conversations';
import {
  hasReadySignal,
  sendReadyToMeetSignal,
} from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function MatchMakerConnectionScreen({ connectionId }: { connectionId: string }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { connection, isLoading, error } = useMatchMakerConnection(connectionId, user?.id);
  const [readySent, setReadySent] = useState(false);
  const [readyConfirmOpen, setReadyConfirmOpen] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);

  const partnerId = connection && user?.id ? partnerUserId(connection, user.id) : null;

  const partnerQuery = useQuery({
    queryKey: ['matchmaker-partner', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      return fetchUserProfileBundle(createClient(), partnerId);
    },
    enabled: !!partnerId,
  });

  useEffect(() => {
    if (!connectionId || !user?.id) return;
    void hasReadySignal(createClient(), connectionId, user.id).then(setReadySent);
  }, [connectionId, user?.id]);

  async function openChat() {
    if (!user?.id || !partnerId) return;
    const client = createClient();
    const chatId = await getOrCreateConversation(client, user.id, partnerId);
    router.push(`/chat/${chatId}`);
  }

  async function confirmReadySignal() {
    setReadyBusy(true);
    const { error: rpcError } = await sendReadyToMeetSignal(createClient(), connectionId);
    setReadyBusy(false);
    setReadyConfirmOpen(false);
    if (!rpcError) setReadySent(true);
  }

  if (isLoading) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell className="animate-pulse p-6">
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

  const partner = partnerQuery.data?.profile;
  const day = connectionDayNumber(connection.connected_at);
  const planDaysLeft = planWindowDaysRemaining(connection.plan_unlock_at);
  const planOpen = isPlanWindowOpen(connection);
  const sharedActivityReady = isSharedActivityAvailable(connection.connected_at);
  const readyAvailable = isReadyToMeetAvailable(connection.connected_at);

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="pt-2">
        {connection.status === 'paused' ? (
          <div
            className="mb-4 rounded-2xl border px-4 py-3 text-[13px] font-semibold"
            style={{ borderColor: '#F59E0B', background: '#FFFBEB', color: '#92400E' }}
          >
            This connection is paused while a subscription issue is resolved.
          </div>
        ) : null}

        <div className="flex flex-col items-center text-center">
          <ProfileAvatar profile={partner} displayName={partner?.display_name} size={88} ringClassName="ring-2 ring-[#9B1B4B]/40" />
          <h1 className="mt-4 font-display text-2xl font-extrabold">
            {partner?.display_name ?? 'Your match'}
          </h1>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Connected · Day {day}
          </p>
        </div>

        <MatchMakerCard className="mt-6">
          {!connection.first_message_at ? (
            <p className="text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Send the first message to start your 21-day plan window.
            </p>
          ) : planOpen ? (
            <p className="text-[14px] font-semibold text-[#9B1B4B]">Plan window is open</p>
          ) : (
            <p className="text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Plan window opens in {planDaysLeft ?? 0} days
            </p>
          )}
        </MatchMakerCard>

        <div className="mt-6 space-y-3">
          <MatchMakerPrimaryButton onClick={() => void openChat()}>Open Chat</MatchMakerPrimaryButton>

          <Link
            href={sharedActivityReady ? `/matchmaker/connection/${connectionId}/activity` : '#'}
            className={`flex min-h-[48px] items-center justify-center rounded-full border font-extrabold ${
              sharedActivityReady ? '' : 'pointer-events-none opacity-50'
            }`}
            style={{ borderColor: MATCHMAKER_THEME.border }}
            onClick={(e) => {
              if (!sharedActivityReady) e.preventDefault();
            }}
          >
            Shared Activity
          </Link>

          {readyAvailable && !readySent ? (
            <button
              type="button"
              onClick={() => setReadyConfirmOpen(true)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-full border font-extrabold"
              style={{ borderColor: MATCHMAKER_THEME.accent, color: MATCHMAKER_THEME.accent }}
            >
              I feel ready to meet
            </button>
          ) : null}

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
              disabled
              className="flex min-h-[48px] w-full items-center justify-center rounded-full font-extrabold opacity-50"
              style={{ background: MATCHMAKER_THEME.disabled, color: '#fff' }}
            >
              Create Plan
            </button>
          )}
        </div>

        <Link
          href={`/matchmaker/connection/${connectionId}/end`}
          className="mt-8 block text-center text-[13px] font-semibold underline"
          style={{ color: MATCHMAKER_THEME.textMuted }}
        >
          End this connection
        </Link>
      </MatchMakerPageShell>

      <ConfirmDialog
        open={readyConfirmOpen}
        title="Send readiness signal?"
        message={`Send a readiness signal to ${partner?.display_name ?? 'your match'}? They will receive a notification only.`}
        confirmLabel={readyBusy ? 'Sending…' : 'Send signal'}
        cancelLabel="Cancel"
        onConfirm={() => void confirmReadySignal()}
        onClose={() => setReadyConfirmOpen(false)}
        busy={readyBusy}
      />
    </MatchMakerLayout>
  );
}
