'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPoolCard } from '@/features/matchmaker/MatchMakerPoolCard';
import { MatchMakerPoolEmptyState } from '@/features/matchmaker/MatchMakerPoolEmptyState';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { expressMatchMakerInterest, fetchMatchMakerPool } from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export function MatchMakerPool() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const viewerQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const poolQuery = useQuery({
    queryKey: ['matchmaker-pool', user?.id],
    queryFn: async () => {
      const client = createClient();
      const result = await fetchMatchMakerPool(client, 12);
      if (result.error) throw new Error(result.error);
      return result;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const cards = poolQuery.data?.data ?? [];
  const emptyReason = poolQuery.data?.emptyReason ?? null;
  const current = cards[index] ?? null;

  const signals = useMemo(() => {
    if (!current || !viewerQuery.data?.profile) return [];
    return buildCompatibilitySignals(
      {
        communication_style: viewerQuery.data.profile.communication_style,
        preferences: viewerQuery.data.profile.preferences,
      },
      current
    );
  }, [current, viewerQuery.data?.profile]);

  const expressMutation = useMutation({
    mutationFn: async (toUserId: string) => {
      const client = createClient();
      const result = await expressMatchMakerInterest(client, toUserId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      if (result.matched && result.connectionId) {
        router.push(`/matchmaker/connection/${result.connectionId}`);
        return;
      }
      setToast('Interest sent');
      setTimeout(() => setToast(null), 2000);
      setIndex((i) => i + 1);
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
    },
  });

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="pt-2">
        <TabPageHeader
          kicker="MatchMaker"
          title="Your pool"
          description="One connection at a time. Take your time."
          icon={<MatchMakerTabIcon size={22} />}
        />

        {poolQuery.isLoading ? (
          <div className="mt-6 h-80 animate-pulse rounded-3xl bg-[#FBF5F0]" />
        ) : null}

        {!poolQuery.isLoading && !current ? (
          <MatchMakerPoolEmptyState reason={emptyReason} className="mt-6" />
        ) : null}

        {current ? (
          <div className="mt-6">
            <MatchMakerPoolCard
              profile={current}
              signals={signals}
              onPass={() => setIndex((i) => i + 1)}
              onExpressInterest={() => expressMutation.mutate(current.user_id)}
              expressBusy={expressMutation.isPending}
            />
          </div>
        ) : null}

        {toast ? (
          <div
            className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold text-white shadow-lg"
            style={{ background: MATCHMAKER_THEME.accent }}
          >
            <MatchMakerTabIcon size={16} className="text-white" />
            {toast}
          </div>
        ) : null}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
