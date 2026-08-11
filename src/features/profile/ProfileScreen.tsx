'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard';
import { TierBadge } from '@/components/subscription/TierBadge';
import { ProfileSettingsRow } from '@/features/profile/ProfileSettingsRow';
import { ProfileSpotlightCard } from '@/components/profile/ProfileSpotlightCard';
import { ProfileVerificationCard } from '@/features/profile/ProfileVerificationCard';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { ProfileMediaGallery } from '@/components/profile/ProfileMediaGallery';
import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import { signOutAndRedirect } from '@/lib/auth/signOut';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { UserVerification } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
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
  IoDiamondOutline,
  IoShieldCheckmarkOutline,
  IoTrashOutline,
  IoWalletOutline,
} from 'react-icons/io5';

function isVerified(status: UserVerification | undefined): boolean {
  return status === 'verified';
}

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const notificationInbox = useNotificationInboxOptional();
  const unreadNotifications = notificationInbox?.unreadCount ?? 0;
  const { subscriptionState } = useSubscriptionContext();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      return bundle;
    },
    enabled: !!user?.id,
  });

  async function signOut() {
    setLogoutBusy(true);
    await signOutAndRedirect({ queryClient });
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
  const name = profile?.display_name?.trim() || user.email?.split('@')[0] || 'You';
  const plansCreated = data?.plansCreated ?? 0;
  const trialNavHint =
    subscriptionState.isTrialActive && !subscriptionState.isPaidActive
      ? `${subscriptionState.trialType === 'gold' ? 'Gold' : 'Silver'} trial · ${subscriptionState.trialDaysRemaining ?? 0}d`
      : undefined;

  return (
    <div className="min-w-0 space-y-6 pb-10 min-[400px]:space-y-8">
      <TabPageHeader
        kicker="Account"
        title="Your profile"
        description="Your name, verification, and visibility in one place."
        icon={<IoPerson size={22} />}
      />

      <div className="rounded-3xl p-[2px] linkup-gradient-primary shadow-md">
        <div className="rounded-[22px] bg-white px-4 py-4 min-[360px]:px-5 min-[360px]:py-5">
          <div className="flex items-start gap-3 min-[360px]:gap-4">
            {profile ? <ProfileMediaGallery profile={profile} variant="compact" /> : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-extrabold text-foreground min-[360px]:text-2xl">{name}</h2>
                <TierBadge tier={subscriptionState.effectiveTier} size="md" />
              </div>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProfileVerificationCard verificationStatus={dbUser?.verification_status} />

      <ProfileSpotlightCard userId={user.id} spotlightUntil={profile?.spotlight_until} />

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

      <SubscriptionStatusCard />

      <PremiumSectionHead title="Settings & account" />

      <div className="rounded-3xl p-[2px] linkup-gradient-primary shadow-md">
        <nav className="overflow-hidden rounded-[22px] bg-white">
          <ProfileSettingsRow
            href="/subscription"
            icon={IoDiamondOutline}
            label="Subscription"
            subtitle={trialNavHint}
          />
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
            subtitle={subscriptionState.effectiveTier !== 'FREE' ? 'Active pin' : 'Gold'}
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
        message="Sign in again to access your inbox and plans. Your account stays saved."
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
