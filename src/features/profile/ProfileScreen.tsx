'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { ProfilePremiumCard } from '@/features/profile/ProfilePremiumCard';
import { ProfileSettingsRow } from '@/features/profile/ProfileSettingsRow';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { ProfileMediaGallery } from '@/components/profile/ProfileMediaGallery';
import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import { profileCompletionPercent } from '@/lib/profile/profileCompletionPercent';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileVideo } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { UserVerification } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  IoAirplaneOutline,
  IoCreateOutline,
  IoGitMergeOutline,
  IoHelpCircleOutline,
  IoLockClosedOutline,
  IoLogOutOutline,
  IoMailUnreadOutline,
  IoNotificationsOutline,
  IoPerson,
  IoShieldCheckmarkOutline,
  IoTrashOutline,
  IoWalletOutline,
} from 'react-icons/io5';

function isVerified(status: UserVerification | undefined): boolean {
  return status === 'verified';
}

function formatPremiumUntil(until: string | null | undefined): string | null {
  if (!until) return null;
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const notificationInbox = useNotificationInboxOptional();
  const unreadNotifications = notificationInbox?.unreadCount ?? 0;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const video = await fetchProfileVideo(client, user.id);
      return { ...bundle, video };
    },
    enabled: !!user?.id,
  });

  async function signOut() {
    setLogoutBusy(true);
    const client = createClient();
    await client.auth.signOut();
    queryClient.clear();
    router.push('/login');
    router.refresh();
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view your profile.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#FFF0F5]/70" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <p className="text-[14px] font-semibold text-[#EF4444]">
        {data?.error ?? (error instanceof Error ? error.message : 'Could not load profile')}
        <button
          type="button"
          className="ml-2 font-extrabold text-primary underline"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </p>
    );
  }

  const profile = data?.profile ?? null;
  const dbUser = data?.dbUser ?? null;
  const verified = isVerified(dbUser?.verification_status);
  const completion = profileCompletionPercent(profile, verified, !!data?.video);
  const name = profile?.display_name?.trim() || user.email?.split('@')[0] || 'You';
  const subscriber = isPremiumSubscriber(dbUser);
  const premiumLabel = formatPremiumUntil(dbUser?.premium_until ?? null);
  const plansCreated = data?.plansCreated ?? 0;

  return (
    <div className="min-w-0 space-y-6 pb-10 min-[400px]:space-y-8">
      <TabPageHeader
        kicker="Account"
        title="Your profile"
        description="Your name, verification, and visibility in one place — same hub as the mobile app."
        icon={<IoPerson size={22} />}
        trailing={
          completion > 0 ? (
            <span className="rounded-full bg-[#EDE8FF] px-3 py-1 text-[11px] font-extrabold text-primary min-[360px]:text-[12px]">
              {completion}% complete
            </span>
          ) : null
        }
      />

      <div className="rounded-3xl p-[2px] linkup-gradient-primary shadow-md">
        <div className="rounded-[22px] bg-white px-4 py-4 min-[360px]:px-5 min-[360px]:py-5">
          <div className="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start">
            {profile ? (
              <ProfileMediaGallery profile={profile} video={data?.video ?? null} variant="compact" />
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-extrabold text-foreground min-[360px]:text-2xl">{name}</h2>
              <p className="truncate text-[13px] font-semibold text-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verified ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
                    Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-muted/10 px-2.5 py-0.5 text-[11px] font-extrabold text-muted">
                    Not verified
                  </span>
                )}
                {subscriber ? (
                  <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-extrabold text-secondary">
                    Premium
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="linkup-card p-5 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Profile</p>
          <p className="font-display mt-1 text-3xl font-extrabold text-primary">{completion}%</p>
          <p className="text-[13px] font-semibold text-muted">complete</p>
        </div>
        <div className="linkup-card p-5 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Verification</p>
          <p className="font-display mt-1 text-3xl font-extrabold text-foreground">{verified ? 'On' : 'Off'}</p>
          <p className="text-[13px] font-semibold text-muted">
            {verified ? 'Others see your badge' : 'Add in Trust center'}
          </p>
        </div>
      </div>

      <div className="linkup-card grid grid-cols-3 divide-x divide-border text-center">
        <div className="p-3 min-[360px]:p-4">
          <p className="font-display text-xl font-extrabold text-foreground min-[360px]:text-2xl">{plansCreated}</p>
          <p className="text-[10px] font-semibold text-muted min-[360px]:text-[12px]">Meetups shared</p>
        </div>
        <div className="p-3 min-[360px]:p-4">
          <p className="font-display text-xl font-extrabold text-foreground min-[360px]:text-2xl">{data?.plansDone ?? 0}</p>
          <p className="text-[10px] font-semibold text-muted min-[360px]:text-[12px]">Completed</p>
        </div>
        <div className="p-3 min-[360px]:p-4">
          <p className="font-display text-xl font-extrabold text-muted min-[360px]:text-2xl">—</p>
          <p className="text-[10px] font-semibold text-muted min-[360px]:text-[12px]">Rating</p>
        </div>
      </div>

      {profile?.bio ? (
        <div className="linkup-card p-5">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">About</p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-foreground">{profile.bio}</p>
        </div>
      ) : null}

      <ProfilePremiumCard isSubscriber={subscriber} premiumUntilLabel={premiumLabel} />

      <PremiumSectionHead title="Settings & account" />

      <div className="rounded-3xl p-[2px] linkup-gradient-primary shadow-md">
        <nav className="overflow-hidden rounded-[22px] bg-white">
          <ProfileSettingsRow href="/profile/edit" icon={IoCreateOutline} label="Edit profile" />
          <ProfileSettingsRow
            href="/trust"
            icon={IoShieldCheckmarkOutline}
            label="Verification status"
            subtitle={dbUser?.verification_status ?? 'unverified'}
          />
          <ProfileSettingsRow
            href="/notifications"
            icon={IoMailUnreadOutline}
            label="Notification inbox"
            subtitle="Meetups, escrow, verification"
            badgeCount={unreadNotifications}
          />
          <ProfileSettingsRow
            href="/wallet"
            icon={IoWalletOutline}
            label="Wallet & credits"
            subtitle="Balance, refunds, goodwill"
          />
          <ProfileSettingsRow
            href="/profile/notifications"
            icon={IoNotificationsOutline}
            label="Notifications & visibility"
          />
          <ProfileSettingsRow href="/profile/privacy" icon={IoLockClosedOutline} label="Privacy & safety" />
          <ProfileSettingsRow
            href="/profile/travel"
            icon={IoAirplaneOutline}
            label="Travel mode"
            subtitle={subscriber ? 'Active pin' : 'Premium'}
          />
          <ProfileSettingsRow href="/support" icon={IoHelpCircleOutline} label="Help & support" />
          <ProfileSettingsRow href="/disputes" icon={IoGitMergeOutline} label="Disputes" />
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center gap-3 border-t border-border/80 px-4 py-3.5 text-left transition hover:bg-[#EDE8FF]/45"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-primary/20 bg-background">
              <IoLogOutOutline size={20} className="text-primary" />
            </span>
            <span className="flex-1 text-[15px] font-extrabold text-foreground">Log out</span>
          </button>
          <ProfileSettingsRow
            href="/profile/delete-account"
            icon={IoTrashOutline}
            label="Delete account"
            danger
            isLast
          />
        </nav>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        message="You will need to sign in again to access your plans and messages."
        cancelLabel="Stay signed in"
        confirmLabel="Log out"
        confirmVariant="neutral"
        busy={logoutBusy}
        onClose={() => setLogoutOpen(false)}
        onConfirm={async () => {
          await signOut();
          setLogoutOpen(false);
        }}
      />

      {isFetching ? (
        <p className="text-center text-[12px] font-semibold text-muted">Refreshing…</p>
      ) : null}
    </div>
  );
}
