'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import {
  MatchMakerCard,
  MatchMakerLayout,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { ageFromBirthDate, buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
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
      const { data, error } = await fetchMatchMakerPool(client, 12);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!user?.id,
  });

  const cards = poolQuery.data ?? [];
  const current = cards[index] ?? null;

  const signals = useMemo(() => {
    if (!current || !viewerQuery.data?.profile) return [];
    return buildCompatibilitySignals(
      {
        communication_style: (viewerQuery.data.profile as { communication_style?: string | null }).communication_style,
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
        void queryClient.invalidateQueries({ queryKey: ['matchmaker-gate', user?.id] });
        router.push(`/matchmaker/connection/${result.connectionId}`);
        return;
      }
      setToast('Interest sent');
      setTimeout(() => setToast(null), 2000);
      setIndex((i) => i + 1);
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
    },
  });

  function pass() {
    setIndex((i) => i + 1);
  }

  const age = ageFromBirthDate(current?.birth_date);

  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-lg px-4 pb-10 pt-2">
        <TabPageHeader
          kicker="MatchMaker"
          title="Your pool"
          description="One connection at a time. Take your time."
          icon={<MatchMakerTabIcon size={22} className="text-[#9B1B4B]" />}
        />

        {poolQuery.isLoading ? (
          <div className="mt-6 h-80 animate-pulse rounded-3xl bg-[#FBF5F0]" />
        ) : null}

        {!poolQuery.isLoading && !current ? (
          <MatchMakerCard className="mt-6 text-center">
            <p className="text-[15px] font-extrabold">No profiles right now</p>
            <p className="mt-2 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Check back soon. Your match may still be in the pool.
            </p>
          </MatchMakerCard>
        ) : null}

        {current ? (
          <MatchMakerCard className="mt-6">
            <div className="flex flex-col items-center text-center">
              <ProfileAvatar
                profile={{
                  primary_photo_url: current.primary_photo_url ?? null,
                  photo_urls: current.photo_urls ?? null,
                  avatar_url: current.avatar_url ?? null,
                }}
                displayName={current.display_name ?? 'Member'}
                size={88}
                ringClassName="ring-2 ring-[#9B1B4B]/30"
              />
              <h2 className="mt-4 font-display text-xl font-extrabold">
                {current.display_name}
                {age != null ? `, ${age}` : ''}
              </h2>
              {current.location_label ? (
                <p className="mt-1 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  {current.location_label}
                </p>
              ) : null}
            </div>

            {signals.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {signals.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border px-3 py-1 text-[12px] font-extrabold"
                    style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surfaceWarm, color: MATCHMAKER_THEME.accent }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={pass}
                className="min-h-[48px] rounded-full border font-extrabold"
                style={{ borderColor: MATCHMAKER_THEME.disabled, color: MATCHMAKER_THEME.textMuted }}
              >
                Pass
              </button>
              <MatchMakerPrimaryButton
                disabled={expressMutation.isPending}
                onClick={() => expressMutation.mutate(current.user_id)}
              >
                {expressMutation.isPending ? 'Sending…' : 'Express Interest'}
              </MatchMakerPrimaryButton>
            </div>
          </MatchMakerCard>
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
      </div>
    </MatchMakerLayout>
  );
}
