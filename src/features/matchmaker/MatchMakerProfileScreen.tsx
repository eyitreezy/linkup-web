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
import { ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import {
  buildMatchMakerProfileInsights,
  communicationStyleLabel,
  meetingIntentLabel,
  profileDistanceLabel,
  sharedLanguages,
} from '@/lib/matchmaker/profileView';
import { interactionStatusLabel } from '@/lib/matchmaker/interaction';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import {
  expressMatchMakerInterest,
  fetchMatchMakerMemberInteraction,
  passMatchMakerPoolProfile,
} from '@/services/matchmaker.service';
import { fetchProfileVideos } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { IoChevronBack, IoShieldCheckmark } from 'react-icons/io5';

function ProfileSection({
  title,
  children,
  warm = false,
  className,
}: {
  title: string;
  children: ReactNode;
  warm?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn('rounded-2xl border p-4', className)}
      style={{
        borderColor: MATCHMAKER_THEME.border,
        background: warm ? MATCHMAKER_THEME.surfaceWarm : MATCHMAKER_THEME.surface,
      }}
    >
      <h2 className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function GlanceChip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold"
      style={{
        borderColor: accent ? `${MATCHMAKER_THEME.accent}40` : MATCHMAKER_THEME.border,
        background: accent ? `${MATCHMAKER_THEME.accent}12` : MATCHMAKER_THEME.surface,
        color: accent ? MATCHMAKER_THEME.accent : MATCHMAKER_THEME.textPrimary,
      }}
    >
      {label}
    </span>
  );
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

  const interactionQuery = useQuery({
    queryKey: ['matchmaker-member-interaction', userId, viewer?.id],
    queryFn: async () => {
      const client = createClient();
      const result = await fetchMatchMakerMemberInteraction(client, userId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: !!viewer?.id && !!userId,
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

  const viewerProfile = viewerQuery.data?.profile;

  const insights = useMemo(() => {
    const candidate = profileQuery.data?.profile;
    if (!viewerProfile || !candidate) return [];
    return buildMatchMakerProfileInsights({
      viewer: {
        communication_style: (viewerProfile as { communication_style?: string | null }).communication_style,
        preferences: viewerProfile.preferences,
        latitude: viewerProfile.latitude,
        longitude: viewerProfile.longitude,
      },
      candidate,
    });
  }, [viewerProfile, profileQuery.data?.profile]);

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
      if (result.alreadySent) {
        setToast('You already expressed interest in this member');
        setTimeout(() => setToast(null), 2200);
      } else if (!result.queued) {
        setToast('Interest sent');
        setTimeout(() => setToast(null), 2000);
      }
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', viewer?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-interest-badge'] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-member-interaction', userId] });
      router.back();
    },
  });

  const passMutation = useMutation({
    mutationFn: async () => {
      const result = await passMatchMakerPoolProfile(createClient(), userId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', viewer?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-member-interaction', userId] });
      router.back();
    },
  });

  const interaction = interactionQuery.data;
  const statusLabel = interaction ? interactionStatusLabel(interaction.viewerState) : null;
  const canExpress = interaction?.canExpress ?? true;
  const canPass = interaction?.canPass ?? true;
  const interestSent = interaction?.viewerState === 'interest_sent';

  function handlePass() {
    passMutation.mutate();
  }

  if (profileQuery.isLoading) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell className="space-y-4">
          <div className="h-10 w-28 animate-pulse rounded-full" style={{ background: MATCHMAKER_THEME.border }} />
          <div className="min-h-[42vh] animate-pulse rounded-none sm:min-h-[45vh]" style={{ background: MATCHMAKER_THEME.surfaceWarm }} />
          <div className="h-40 animate-pulse rounded-2xl" style={{ background: MATCHMAKER_THEME.border }} />
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
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-3 text-[13px] font-extrabold shadow-sm"
            style={{ borderColor: MATCHMAKER_THEME.border, color: MATCHMAKER_THEME.textPrimary }}
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
  const languages = Array.isArray(prefs.languages) ? (prefs.languages as string[]) : [];
  const sharedLangs = sharedLanguages(viewerProfile?.preferences, prefs);
  const prompts = Array.isArray(prefs.prompt_answers)
    ? (prefs.prompt_answers as { prompt?: string; answer?: string }[])
    : [];
  const commLabel = communicationStyleLabel(
    (profile as { communication_style?: string | null }).communication_style
  );
  const intentLabel = meetingIntentLabel(prefs.meeting_intent);
  const distanceLabel = profileDistanceLabel(viewerProfile, profile);

  const sharedInsights = insights.filter((i) => i.shared);
  const contextInsights = insights.filter((i) => !i.shared);

  return (
    <MatchMakerLayout>
      <MatchMakerSlideIn>
        <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
          {/* Back toolbar sits above the slider, not on media */}
          <MatchMakerPageShell className="pb-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-3 text-[13px] font-extrabold shadow-sm transition hover:opacity-95 active:scale-[0.98]"
              style={{ borderColor: MATCHMAKER_THEME.border, color: MATCHMAKER_THEME.textPrimary }}
              aria-label="Back to pool"
            >
              <IoChevronBack size={18} />
              Back to pool
            </button>
          </MatchMakerPageShell>

          <div className="relative w-full overflow-hidden">
            <HostMediaGallery profile={profile} videos={videos} layout="hero" className="rounded-none" />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#FDF8F4] via-[#FDF8F4]/25 to-transparent"
              aria-hidden
            />
          </div>

          <MatchMakerPageShell className="relative -mt-8 space-y-4">
            <header>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: MATCHMAKER_THEME.accent }}>
                MatchMaker profile
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
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
                  {distanceLabel ? `, ${distanceLabel}` : ''}
                </p>
              ) : distanceLabel ? (
                <p className="mt-1 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  {distanceLabel}
                </p>
              ) : null}

              {(commLabel || intentLabel || profile.verified_badge) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {commLabel ? <GlanceChip label={commLabel} accent /> : null}
                  {intentLabel ? <GlanceChip label={`On LinkUp for ${intentLabel.toLowerCase()}`} /> : null}
                  {profile.verified_badge ? <GlanceChip label="Identity verified" accent /> : null}
                </div>
              ) : null}
            </header>

            {sharedInsights.length > 0 ? (
              <ProfileSection title="What you have in common" warm>
                <ul className="space-y-2.5">
                  {sharedInsights.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2.5 text-[14px] font-semibold leading-snug"
                      style={{ color: MATCHMAKER_THEME.textPrimary }}
                    >
                      <span className="mt-0.5 shrink-0 text-base" aria-hidden>{item.icon}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </ProfileSection>
            ) : (
              <ProfileSection title="What you have in common" warm>
                <p className="text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Explore their bio and prompts below. Shared signals appear here when your profiles overlap.
                </p>
              </ProfileSection>
            )}

            {contextInsights.length > 0 ? (
              <ProfileSection title="How they communicate">
                <ul className="space-y-2">
                  {contextInsights.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 text-[14px] font-semibold"
                      style={{ color: MATCHMAKER_THEME.textPrimary }}
                    >
                      <span aria-hidden>{item.icon}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </ProfileSection>
            ) : null}

            {profile.bio?.trim() ? (
              <ProfileSection title="About">
                <p className="text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                  {profile.bio.trim()}
                </p>
              </ProfileSection>
            ) : null}

            {interests.length > 0 ? (
              <ProfileSection title="Interests">
                <div className="flex flex-wrap gap-2">
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
              </ProfileSection>
            ) : null}

            {languages.length > 0 ? (
              <ProfileSection title="Languages">
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => {
                    const isShared = sharedLangs.includes(lang);
                    return (
                      <span
                        key={lang}
                        className="rounded-full border px-3 py-1 text-[12px] font-extrabold"
                        style={{
                          borderColor: isShared ? `${MATCHMAKER_THEME.accent}50` : MATCHMAKER_THEME.border,
                          background: isShared ? `${MATCHMAKER_THEME.accent}14` : MATCHMAKER_THEME.surfaceWarm,
                          color: isShared ? MATCHMAKER_THEME.accent : MATCHMAKER_THEME.textPrimary,
                        }}
                      >
                        {lang}
                        {isShared ? ' (shared)' : ''}
                      </span>
                    );
                  })}
                </div>
              </ProfileSection>
            ) : null}

            {prompts.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  Profile prompts
                </h2>
                {prompts.map((prompt, index) => (
                  <div
                    key={`${prompt.prompt ?? 'prompt'}-${index}`}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
                  >
                    <p className="text-[13px] font-extrabold leading-snug" style={{ color: MATCHMAKER_THEME.accent }}>
                      {prompt.prompt}
                    </p>
                    <p className="mt-2 text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textPrimary }}>
                      {prompt.answer}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="pb-2 text-center text-[11px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Values and dealbreakers stay private. Only compatibility signals and public profile details are shown here.
            </p>
          </MatchMakerPageShell>

          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-8px_24px_rgba(155,27,75,0.08)]"
            style={{ borderColor: MATCHMAKER_THEME.border }}
          >
            <div className="mx-auto max-w-3xl">
              {statusLabel && !canExpress && !canPass ? (
                <p
                  className="rounded-full border px-4 py-3 text-center text-[13px] font-extrabold"
                  style={{
                    borderColor: MATCHMAKER_THEME.border,
                    background: MATCHMAKER_THEME.surfaceWarm,
                    color: MATCHMAKER_THEME.accent,
                  }}
                >
                  {statusLabel}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <MatchMakerSecondaryButton
                    onClick={handlePass}
                    disabled={!canPass || passMutation.isPending || expressMutation.isPending}
                  >
                    {passMutation.isPending ? 'Passing…' : 'Pass'}
                  </MatchMakerSecondaryButton>
                  <MatchMakerPrimaryButton
                    disabled={expressMutation.isPending || !canExpress || interestSent}
                    onClick={() => expressMutation.mutate()}
                  >
                    {expressMutation.isPending
                      ? 'Sending…'
                      : interestSent
                        ? 'Interest sent'
                        : 'Express Interest'}
                  </MatchMakerPrimaryButton>
                </div>
              )}
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
