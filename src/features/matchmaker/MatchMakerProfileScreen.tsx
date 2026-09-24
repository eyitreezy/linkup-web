'use client';

import { HostMediaGallery } from '@/components/profile/HostMediaGallery';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import {
  MatchMakerLayout,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
  MatchMakerSecondaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerSlideIn } from '@/features/matchmaker/MatchMakerSlideIn';
import {
  ageFromBirthDate,
  buildCompatibilitySignals,
  type PoolProfileRow,
} from '@/lib/matchmaker/compatibility';
import { markPoolMemberDismissed } from '@/lib/matchmaker/poolNavigation';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { expressMatchMakerInterest } from '@/services/matchmaker.service';
import { fetchProfileVideos } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import type { DbProfile } from '@/types/database';
import { useAuthStore } from '@/stores/auth-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IoChevronBack, IoShieldCheckmark } from 'react-icons/io5';

function profileToPoolRow(profile: DbProfile): PoolProfileRow {
  return {
    user_id: profile.user_id,
    display_name: profile.display_name,
    birth_date: profile.birth_date ?? null,
    location_label: profile.location_label,
    photo_urls: profile.photo_urls,
    primary_photo_url: profile.primary_photo_url,
    avatar_url: profile.avatar_url,
    preferences: profile.preferences,
    communication_style: (profile as { communication_style?: string | null }).communication_style ?? null,
    latitude: profile.latitude,
    longitude: profile.longitude,
    verified_badge: profile.verified_badge,
  };
}

function signalIcon(signal: string): string {
  if (signal.startsWith('Shared interest')) return '🏷️';
  if (signal.includes('communication') || signal.includes('contact')) return '💬';
  if (signal.startsWith('Located in')) return '📍';
  return '✨';
}

type Props = { userId: string };

export function MatchMakerProfileScreen({ userId }: Props) {
  const viewer = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const viewerQuery = useQuery({
    queryKey: ['profile-bundle', viewer?.id],
    queryFn: async () => {
      if (!viewer?.id) return null;
      return fetchUserProfileBundle(createClient(), viewer.id);
    },
    enabled: !!viewer?.id,
  });

  const profileQuery = useQuery({
    queryKey: ['matchmaker-profile', userId],
    queryFn: async () => {
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, userId);
      if (bundle.error) throw new Error(bundle.error);
      if (!bundle.profile) return null;
      const videos = await fetchProfileVideos(client, userId);
      return { profile: bundle.profile, videos };
    },
    enabled: !!userId,
  });

  const signals = useMemo(() => {
    const viewerProfile = viewerQuery.data?.profile;
    const candidate = profileQuery.data?.profile;
    if (!viewerProfile || !candidate) return [];
    return buildCompatibilitySignals(
      {
        communication_style: (viewerProfile as { communication_style?: string | null }).communication_style,
        preferences: viewerProfile.preferences,
      },
      profileToPoolRow(candidate)
    );
  }, [viewerQuery.data?.profile, profileQuery.data?.profile]);

  const expressMutation = useMutation({
    mutationFn: async () => {
      const result = await expressMatchMakerInterest(createClient(), userId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      if (result.matched && result.connectionId) {
        router.replace(`/matchmaker/connection/${result.connectionId}`);
        return;
      }
      setToast('Interest sent');
      setTimeout(() => setToast(null), 2000);
      markPoolMemberDismissed(userId);
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', viewer?.id] });
      router.back();
    },
  });

  function handlePass() {
    markPoolMemberDismissed(userId);
    router.back();
  }

  if (profileQuery.isLoading) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell className="animate-pulse space-y-4">
          <div className="h-10 w-24 rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
          <div className="min-h-[42vh] rounded-none sm:min-h-[45vh]" style={{ background: MATCHMAKER_THEME.surfaceWarm }} />
          <div className="h-40 rounded-2xl" style={{ background: MATCHMAKER_THEME.border }} />
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (profileQuery.error || !profileQuery.data?.profile) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-[40px] items-center gap-1 text-[13px] font-extrabold"
            style={{ color: MATCHMAKER_THEME.accent }}
          >
            <IoChevronBack size={18} />
            Back
          </button>
          <p className="mt-6 text-[14px] font-semibold text-muted">This profile is unavailable.</p>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  const { profile, videos } = profileQuery.data;
  const age = ageFromBirthDate(profile.birth_date);
  const displayName = profile.display_name?.trim() || 'Member';
  const prefs = profile.preferences ?? {};
  const interests = Array.isArray(prefs.interests) ? (prefs.interests as string[]) : [];
  const prompts = Array.isArray(prefs.prompt_answers)
    ? (prefs.prompt_answers as { prompt?: string; answer?: string }[])
    : [];

  return (
    <MatchMakerLayout>
      <MatchMakerSlideIn>
        <div className="relative pb-28">
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute left-4 top-4 z-30 inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white/95 px-3 text-[13px] font-extrabold shadow-sm backdrop-blur-sm transition hover:bg-white"
            style={{ borderColor: MATCHMAKER_THEME.border, color: MATCHMAKER_THEME.textPrimary }}
            aria-label="Back to pool"
          >
            <IoChevronBack size={18} />
            Back
          </button>

          <div className="relative w-full overflow-hidden">
            <HostMediaGallery profile={profile} videos={videos} layout="hero" className="rounded-none" />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#FDF8F4] via-[#FDF8F4]/30 to-transparent"
              aria-hidden
            />
          </div>

          <MatchMakerPageShell className="relative -mt-10 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                  {displayName}
                  {age != null ? `, ${age}` : ''}
                </h1>
                {profile.verified_badge ? (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                    style={{ background: `${MATCHMAKER_THEME.accent}18`, color: MATCHMAKER_THEME.accent }}
                  >
                    <IoShieldCheckmark size={11} />
                    Verified
                  </span>
                ) : null}
              </div>
              {profile.location_label ? (
                <p className="mt-1 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  {profile.location_label}
                </p>
              ) : null}
            </div>

            {signals.length > 0 ? (
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surfaceWarm }}
              >
                <p className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  What you have in common
                </p>
                <ul className="mt-3 space-y-2">
                  {signals.map((signal) => (
                    <li key={signal} className="flex items-start gap-2 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                      <span aria-hidden>{signalIcon(signal)}</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {interests.length > 0 ? (
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
              >
                <p className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Interests
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {interests.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border px-3 py-1 text-[12px] font-extrabold"
                      style={{
                        borderColor: MATCHMAKER_THEME.border,
                        background: MATCHMAKER_THEME.surfaceWarm,
                        color: MATCHMAKER_THEME.accent,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.bio?.trim() ? (
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
              >
                <p className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  About
                </p>
                <p className="mt-2 text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                  {profile.bio.trim()}
                </p>
              </div>
            ) : null}

            {prompts.length > 0 ? (
              <div className="space-y-3">
                {prompts.map((prompt, index) => (
                  <div
                    key={`${prompt.prompt ?? 'prompt'}-${index}`}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
                  >
                    <p className="text-[13px] font-extrabold" style={{ color: MATCHMAKER_THEME.accent }}>
                      {prompt.prompt}
                    </p>
                    <p className="mt-2 text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                      {prompt.answer}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </MatchMakerPageShell>

          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-8px_24px_rgba(155,27,75,0.08)]"
            style={{ borderColor: MATCHMAKER_THEME.border }}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <MatchMakerSecondaryButton variant="text" onClick={handlePass} className="shrink-0">
                Pass
              </MatchMakerSecondaryButton>
              <MatchMakerPrimaryButton
                disabled={expressMutation.isPending}
                onClick={() => expressMutation.mutate()}
                className="flex-1"
              >
                {expressMutation.isPending ? 'Sending…' : 'Express Interest'}
              </MatchMakerPrimaryButton>
            </div>
          </div>

          {toast ? (
            <div
              className="fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold text-white shadow-lg"
              style={{ background: MATCHMAKER_THEME.accent }}
            >
              <MatchMakerTabIcon size={16} className="text-white" />
              {toast}
            </div>
          ) : null}
        </div>
      </MatchMakerSlideIn>
    </MatchMakerLayout>
  );
}
