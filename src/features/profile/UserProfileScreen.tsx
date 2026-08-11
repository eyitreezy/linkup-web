'use client';

import { ReviewList } from '@/components/profile/ReviewList';
import { TierBadge } from '@/components/subscription/TierBadge';
import { HostMediaGallery } from '@/components/profile/HostMediaGallery';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { derivePresenceUi } from '@/lib/presence/hostPresenceStatus';
import {
  fetchUserPresence,
  subscribeUserPresenceRealtime,
} from '@/lib/presence/subscribeUserPresenceRealtime';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileVideos } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbProfile, DbUserPresence } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircle,
  IoChevronBack,
  IoHandLeftOutline,
  IoLockClosedOutline,
} from 'react-icons/io5';

type Props = { userId: string };

export function UserProfileScreen({ userId }: Props) {
  const router = useRouter();
  const viewer = useAuthStore((s) => s.user);
  const [theirPresence, setTheirPresence] = useState<DbUserPresence | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const viewerBundleQuery = useQuery({
    queryKey: ['profile-bundle', viewer?.id],
    queryFn: async () => {
      if (!viewer?.id) return null;
      const client = createClient();
      return fetchUserProfileBundle(client, viewer.id);
    },
    enabled: !!viewer?.id,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      const client = createClient();
      const [{ data: profile, error: pe }, { data: userRow }] = await Promise.all([
        client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        client.from('users').select('subscription_tier').eq('id', userId).maybeSingle(),
      ]);
      if (pe) throw new Error(pe.message);
      if (!profile) return null;
      const videos = await fetchProfileVideos(client, userId);
      return {
        profile: profile as DbProfile,
        videos,
        subscriptionTier: (userRow as { subscription_tier?: SubscriptionTier } | null)?.subscription_tier ?? 'FREE',
      };
    },
  });

  const isSelf = !!(viewer?.id && viewer.id === userId);
  const canInteract = !!(viewer?.id && !isSelf);
  const viewerProfile = viewerBundleQuery.data?.profile ?? null;

  useEffect(() => {
    if (!canInteract || !data?.profile || data.profile.is_profile_public === false || !viewer?.id) return;
    const client = createClient();
    void (async () => {
      const { fetchViewerPrivacyPrefs, shouldSkipProfileViewRecording } = await import(
        '@/lib/plans/incognitoEngagement'
      );
      const prefs = await fetchViewerPrivacyPrefs(client, viewer.id);
      if (shouldSkipProfileViewRecording(prefs)) return;
      await client.from('profile_views').insert({
        viewer_id: viewer.id,
        viewed_user_id: userId,
      });
    })();
  }, [canInteract, data?.profile, userId, viewer]);

  useEffect(() => {
    if (!canInteract) {
      setTheirPresence(null);
      return;
    }
    let cancelled = false;
    void fetchUserPresence(userId).then((row) => {
      if (!cancelled) setTheirPresence(row);
    });
    const unsub = subscribeUserPresenceRealtime(userId, (row) => {
      if (!cancelled) setTheirPresence(row);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [canInteract, userId]);

  const presenceUi = useMemo(
    () => derivePresenceUi(viewerProfile, data?.profile?.preferences, theirPresence),
    [viewerProfile, data?.profile?.preferences, theirPresence]
  );

  async function onMessage() {
    if (!viewer?.id || chatBusy) return;
    setChatBusy(true);
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, viewer.id, userId);
      router.push(path);
    } catch (e) {
      setStatusDialog({
        variant: 'error',
        title: 'Could not open chat',
        message: e instanceof Error ? e.message : 'Try again in a moment.',
      });
    } finally {
      setChatBusy(false);
    }
  }

  async function onBlock() {
    if (!viewer?.id || blockBusy) return;
    const confirmed = window.confirm('Block this person? You will not see their plans in your feed.');
    if (!confirmed) return;
    setBlockBusy(true);
    try {
      const client = createClient();
      const { error: be } = await client.from('user_blocks').insert({
        blocker_id: viewer.id,
        blocked_id: userId,
      });
      if (be) throw new Error(be.message);
      router.back();
    } catch (e) {
      setStatusDialog({
        variant: 'error',
        title: 'Could not block',
        message: e instanceof Error ? e.message : 'Try again in a moment.',
      });
    } finally {
      setBlockBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        <div className="h-10 w-24 animate-pulse rounded-full bg-[#EDE8FF]/80" />
        <div className="h-72 animate-pulse rounded-3xl bg-[#EDE8FF]/70" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#FFF0F5]/70" />
      </div>
    );
  }

  if (error || !data?.profile || data.profile.is_profile_public === false) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 text-[13px] font-extrabold text-primary"
        >
          <IoChevronBack size={18} />
          Back
        </Link>
        <AppEmptyState
          icon={<IoLockClosedOutline size={32} className="text-muted" />}
          title="Profile unavailable"
          description="This member may have a private profile or the link is invalid."
          action={{ label: 'Back to Discover', href: '/discover' }}
          className="mt-6"
        />
      </div>
    );
  }

  const { profile, videos, subscriptionTier } = data;
  const primary = resolvePrimaryPhotoUrl(profile);
  const prefs = profile.preferences ?? {};
  const name = profile.display_name?.trim() || 'LinkUp member';

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-border/70 bg-white/90 px-3 text-[13px] font-extrabold text-foreground transition hover:bg-[#EDE8FF]/50 active:scale-[0.98]"
      >
        <IoChevronBack size={18} />
        Back
      </button>

      <div className="text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-secondary">Member</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <h1 className="font-display text-2xl font-extrabold text-foreground min-[400px]:text-3xl">{name}</h1>
          <TierBadge tier={subscriptionTier} size="md" />
        </div>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          {isSelf ? 'This is how others see your public profile.' : 'Public profile on LinkUp'}
        </p>
      </div>

      <div className="linkup-card overflow-hidden p-4 min-[400px]:p-5">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full p-[3px] linkup-gradient-primary shadow-md">
            <AvatarWithPresence
              uri={primary ?? profile.avatar_url}
              name={name}
              size={88}
              presence={isSelf ? null : presenceUi}
              showDot={!isSelf && !!presenceUi?.dot}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <p className="font-display text-lg font-extrabold text-foreground">{name}</p>
            <TierBadge tier={subscriptionTier} size="md" />
            {profile.verified_badge ? (
              <span className="inline-flex items-center gap-1 rounded-full linkup-gradient-primary px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
                <IoCheckmarkCircle size={13} />
                Verified
              </span>
            ) : null}
          </div>
          {!isSelf && presenceUi?.caption ? (
            <p className="mt-1 text-[12px] font-semibold text-muted">{presenceUi.caption}</p>
          ) : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-primary/10">
          <HostMediaGallery profile={profile} videos={videos} className="rounded-2xl" />
        </div>

        <div className="mt-5">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">About</p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-foreground">
            {profile.bio?.trim() || 'No bio yet.'}
          </p>
        </div>
      </div>

      {Array.isArray(prefs.interests) && prefs.interests.length > 0 ? (
        <div className="linkup-card p-4">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Interests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(prefs.interests as string[]).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-primary/20 bg-white px-3 py-1 text-[12px] font-extrabold text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {Array.isArray(prefs.prompt_answers) &&
      (prefs.prompt_answers as { prompt?: string; answer?: string }[]).length > 0 ? (
        <div className="space-y-3">
          {(prefs.prompt_answers as { prompt?: string; answer?: string }[]).map((p, i) => (
            <div key={i} className="linkup-card p-4">
              <p className="text-[13px] font-extrabold text-secondary">{p.prompt}</p>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-foreground">{p.answer}</p>
            </div>
          ))}
        </div>
      ) : null}

      {(profile.completed_meetup_count ?? 0) > 0 ? (
        <section className="space-y-3">
          <SectionHead title="Reviews" />

          {(profile.completed_meetup_count ?? 0) >= 3 && profile.host_rating_score ? (
            <div className="linkup-card p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-foreground">
                  {profile.host_rating_score.toFixed(1)}
                </span>
                <span className="text-xl text-amber-500" aria-hidden>
                  ★
                </span>
                <span className="text-[13px] font-semibold text-muted">
                  {profile.host_rating_count ?? 0}{' '}
                  {(profile.host_rating_count ?? 0) !== 1 ? 'reviews' : 'review'}
                </span>
              </div>

              <div className="mt-3 space-y-1">
                {[
                  { label: 'Punctuality', value: profile.host_score_punctuality },
                  { label: 'Conduct', value: profile.host_score_conduct },
                  { label: 'Plan quality', value: profile.host_score_plan_quality },
                ]
                  .filter((d) => d.value != null)
                  .map((d) => (
                    <div key={d.label} className="flex justify-between">
                      <span className="text-[12px] font-semibold text-muted">{d.label}</span>
                      <span className="text-[12px] font-extrabold text-foreground">
                        {d.value?.toFixed(1)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] font-semibold text-muted">New to LinkUp</p>
          )}

          <ReviewList profileUserId={profile.user_id} />
        </section>
      ) : null}

      {canInteract ? (
        <>
          <section className="space-y-3">
            <SectionHead title="Connect" />
            <button
              type="button"
              disabled={chatBusy}
              onClick={() => void onMessage()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
            >
              <IoChatbubbleEllipsesOutline size={20} />
              {chatBusy ? 'Opening chat…' : `Message ${name.split(' ')[0]}`}
            </button>
          </section>

          <section className="space-y-3">
            <SectionHead title="Safety" />
            <button
              type="button"
              disabled={blockBusy}
              onClick={() => void onBlock()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-[14px] font-extrabold text-red-600 transition hover:bg-red-100/80 active:scale-[0.98] disabled:opacity-60"
            >
              <IoHandLeftOutline size={18} />
              {blockBusy ? 'Blocking…' : 'Block member'}
            </button>
            <p className="text-[12px] font-semibold leading-relaxed text-muted">
              Blocked members won&apos;t appear in your Discover feed or messages.
            </p>
          </section>
        </>
      ) : null}

      <AppStatusDialog
        open={statusDialog != null}
        variant={statusDialog?.variant ?? 'error'}
        title={statusDialog?.title ?? ''}
        message={statusDialog?.message ?? ''}
        buttonLabel="OK"
        onClose={() => setStatusDialog(null)}
      />
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-foreground">{title}</p>
      </div>
      <div className="mt-2 h-px w-full bg-gradient-to-r from-primary/30 via-secondary/20 to-transparent" />
    </div>
  );
}
