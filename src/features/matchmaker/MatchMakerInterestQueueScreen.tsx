'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { MatchMakerInterestQueueCard } from '@/features/matchmaker/MatchMakerInterestQueueCard';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPageHeader } from '@/features/matchmaker/MatchMakerPageHeader';
import { useMatchMakerInterestRealtime } from '@/hooks/useMatchMakerInterestRealtime';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import {
  expressMatchMakerInterest,
  fetchMatchMakerInterestQueue,
  markMatchMakerInterestsOpened,
  passMatchMakerInterest,
} from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoHeart } from 'react-icons/io5';

type Segment = 'sent' | 'received';

export function MatchMakerInterestQueueScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<Segment>('received');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useMatchMakerInterestRealtime(user?.id);

  const viewerQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const queueQuery = useQuery({
    queryKey: ['matchmaker-interest-queue', user?.id],
    queryFn: async () => {
      const client = createClient();
      const result = await fetchMatchMakerInterestQueue(client, user?.id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const client = createClient();
    void markMatchMakerInterestsOpened(client).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-badge', user.id] });
    });
  }, [user?.id, queryClient]);

  const sent = queueQuery.data?.sent ?? [];
  const received = queueQuery.data?.received ?? [];
  const list = segment === 'sent' ? sent : received;

  const signalsByUserId = useMemo(() => {
    const viewer = viewerQuery.data?.profile;
    if (!viewer) return {};
    return Object.fromEntries(
      list.map((row) => [
        row.user_id,
        buildCompatibilitySignals(
          {
            communication_style: viewer.communication_style,
            preferences: viewer.preferences,
          },
          row
        ),
      ])
    );
  }, [list, viewerQuery.data?.profile]);

  const expressMutation = useMutation({
    mutationFn: async (toUserId: string) => {
      setBusyUserId(toUserId);
      const client = createClient();
      const result = await expressMatchMakerInterest(client, toUserId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      setBusyUserId(null);
      if (result.matched && result.connectionId) {
        router.push(`/matchmaker/connection/${result.connectionId}`);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-badge'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool'] });
    },
    onError: () => setBusyUserId(null),
  });

  const passMutation = useMutation({
    mutationFn: async (fromUserId: string) => {
      setBusyUserId(fromUserId);
      const client = createClient();
      const result = await passMatchMakerInterest(client, fromUserId);
      if (result.error) throw new Error(result.error);
      if (!result.ok) throw new Error('Could not pass on this interest');
      return result;
    },
    onSuccess: () => {
      setBusyUserId(null);
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-badge'] });
    },
    onError: () => setBusyUserId(null),
  });

  if (!user) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            <Link href="/login" className="font-extrabold text-primary">
              Sign in
            </Link>{' '}
            to view your interest queue.
          </p>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  const showLoading = queueQuery.isLoading && !queueQuery.data;

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="space-y-6 pb-10">
        <MatchMakerPageHeader
          kicker="MatchMaker"
          title="People who expressed interest"
          subtitle="Review who has reached out and respond when you are ready."
          backLabel="Back to pool"
          onBack={() => router.push('/matchmaker')}
        />

        <section className="space-y-3">
          <h2
            className="text-[12px] font-extrabold uppercase tracking-wide"
            style={{ color: MATCHMAKER_THEME.textMuted }}
          >
            Sent and received
          </h2>
          <div
            className="flex rounded-2xl border p-1"
            style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surfaceWarm }}
          >
            {(['sent', 'received'] as const).map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegment(seg)}
                className={cn(
                  'min-w-0 flex-1 rounded-xl px-2 py-2.5 text-[12px] font-extrabold transition min-[360px]:px-4 min-[360px]:text-[13px]',
                  segment === seg ? 'text-white shadow-sm' : 'hover:opacity-90'
                )}
                style={
                  segment === seg
                    ? { background: `linear-gradient(135deg, ${MATCHMAKER_THEME.accent} 0%, #6C63FF 100%)` }
                    : { color: MATCHMAKER_THEME.textMuted }
                }
              >
                <span className="block truncate">
                  {seg === 'sent' ? `Sent (${sent.length})` : `Received (${received.length})`}
                </span>
              </button>
            ))}
          </div>
        </section>

        {showLoading ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-28 animate-pulse rounded-2xl bg-[#FBF5F0]" />
            ))}
          </ul>
        ) : null}

        {queueQuery.error ? (
          <div className="rounded-2xl border p-4 text-center" style={{ borderColor: MATCHMAKER_THEME.border }}>
            <p className="text-[14px] font-semibold text-[#EF4444]">
              Could not load your interest queue. Please try again.
            </p>
            <button
              type="button"
              onClick={() => void queueQuery.refetch()}
              className="mt-3 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
              style={{ background: MATCHMAKER_THEME.accent }}
            >
              Retry
            </button>
          </div>
        ) : null}

        {!showLoading && !queueQuery.error && list.length === 0 ? (
          <AppEmptyState
            icon={<IoHeart size={40} style={{ color: MATCHMAKER_THEME.accent }} />}
            title={segment === 'received' ? 'No one has expressed interest yet' : 'No interests sent yet'}
            description={
              segment === 'received'
                ? 'Keep browsing. Your match is in the pool.'
                : 'When you express interest from the pool, members you reach out to appear here.'
            }
            action={
              segment === 'received'
                ? { label: 'Browse pool', href: '/matchmaker', variant: 'primary' }
                : undefined
            }
          />
        ) : null}

        {!showLoading && !queueQuery.error && list.length > 0 ? (
          <ul className="space-y-3">
            {list.map((row) => (
              <li key={row.interest_id}>
                <MatchMakerInterestQueueCard
                  row={row}
                  mode={segment}
                  signals={signalsByUserId[row.user_id] ?? []}
                  onPass={
                    segment === 'received'
                      ? () => passMutation.mutate(row.user_id)
                      : undefined
                  }
                  onExpressInterest={
                    segment === 'received'
                      ? () => expressMutation.mutate(row.user_id)
                      : undefined
                  }
                  expressBusy={busyUserId === row.user_id && expressMutation.isPending}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
