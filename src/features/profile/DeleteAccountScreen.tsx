'use client';

import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { Input } from '@/components/ui/Input';
import { useWebPush } from '@/hooks/useWebPush';
import {
  DELETION_REASONS,
  hideProfileForBreak,
  pauseAllNotifications,
  suspendAccountWithFeedback,
  type DeletionReasonId,
} from '@/lib/profile/accountDeletion';
import { signOutAndRedirect } from '@/lib/auth/signOut';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  IoArrowBack,
  IoEyeOffOutline,
  IoNotificationsOffOutline,
  IoPauseCircleOutline,
  IoTrashOutline,
  IoWarningOutline,
} from 'react-icons/io5';

const CONFIRM_PHRASE = 'DELETE';

type StatusDialog = {
  title: string;
  message: string;
  variant: 'success' | 'error' | 'info';
  buttonLabel?: string;
  onDismiss?: () => void;
};

export function DeleteAccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { isSubscribed: moodPushEnabled, unsubscribe: unsubscribeWebPush } = useWebPush();

  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState<DeletionReasonId | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [busy, setBusy] = useState<'hide' | 'pause' | 'delete' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<StatusDialog | null>(null);

  const { data: profileBundle, isLoading } = useQuery({
    queryKey: ['profile-bundle', userId],
    queryFn: async () => {
      if (!userId) return null;
      return fetchUserProfileBundle(createClient(), userId);
    },
    enabled: !!userId,
  });

  const profile = profileBundle?.profile ?? null;
  const prefs = profile?.preferences ?? {};

  const profileHidden = profile?.is_profile_public === false;
  const notificationsPaused =
    prefs.notifications?.push === false && prefs.notifications?.email === false;

  const canSubmit = confirm.trim() === CONFIRM_PHRASE;
  const reasonReady = reason !== '';

  const selectedReasonLabel = useMemo(
    () => DELETION_REASONS.find((r) => r.id === reason)?.label ?? '',
    [reason]
  );

  function showStatus(dialog: StatusDialog) {
    setStatusDialog(dialog);
  }

  async function refreshProfile() {
    await queryClient.invalidateQueries({ queryKey: ['profile-bundle', userId] });
  }

  async function handleTakeABreak() {
    if (!userId || profileHidden) return;
    setBusy('hide');
    try {
      const result = await hideProfileForBreak(userId);
      if (result.error) {
        showStatus({
          variant: 'error',
          title: 'Could not hide profile',
          message: result.error,
        });
        return;
      }
      await refreshProfile();
      showStatus({
        variant: 'success',
        title: 'Profile hidden',
        message:
          'You are taking a break. Your profile is hidden from Discover and new visitors. You can turn visibility back on anytime from Edit profile.',
        buttonLabel: 'Got it',
      });
    } finally {
      setBusy(null);
    }
  }

  async function handlePauseNotifications() {
    if (!userId || notificationsPaused) return;
    setBusy('pause');
    try {
      const result = await pauseAllNotifications(userId, prefs);
      if (result.error) {
        showStatus({
          variant: 'error',
          title: 'Could not pause notifications',
          message: result.error,
        });
        return;
      }
      if (moodPushEnabled) {
        await unsubscribeWebPush();
      }
      await refreshProfile();
      showStatus({
        variant: 'success',
        title: 'Notifications paused',
        message:
          'Push and email notifications are off. You can turn them back on anytime from Notifications & visibility in your profile.',
        buttonLabel: 'Got it',
      });
    } finally {
      setBusy(null);
    }
  }

  async function performDelete() {
    if (!userId || !reason) return;
    setBusy('delete');
    try {
      const result = await suspendAccountWithFeedback(
        userId,
        prefs,
        reason,
        reason === 'other' ? otherReason : undefined
      );
      if (result.error) {
        showStatus({
          variant: 'error',
          title: 'Could not delete account',
          message: result.error,
        });
        return;
      }
      setConfirmOpen(false);
      showStatus({
        variant: 'success',
        title: 'Account suspended',
        message:
          'Your profile is hidden and your session will end. Contact support if you need full data deletion under our privacy policy.',
        buttonLabel: 'Sign out',
        onDismiss: () => void signOutAndRedirect({ redirectTo: '/login', queryClient }),
      });
    } finally {
      setBusy(null);
    }
  }

  function handleDeletePress() {
    if (!reasonReady) {
      showStatus({
        variant: 'info',
        title: 'Tell us why you’re leaving',
        message: 'Please choose a reason before deleting your account. This helps us improve LinkUp.',
      });
      return;
    }
    if (!canSubmit) {
      showStatus({
        variant: 'info',
        title: 'Confirmation required',
        message: `Type ${CONFIRM_PHRASE} in uppercase exactly as shown to continue.`,
      });
      return;
    }
    setConfirmOpen(true);
  }

  if (isLoading) {
    return <div className="mx-auto h-48 max-w-lg animate-pulse rounded-2xl bg-[#EDE8FF]/70" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <AppStatusDialog
        open={statusDialog !== null}
        title={statusDialog?.title ?? ''}
        message={statusDialog?.message ?? ''}
        variant={statusDialog?.variant ?? 'success'}
        buttonLabel={statusDialog?.buttonLabel ?? 'Got it'}
        onClose={() => {
          const action = statusDialog?.onDismiss;
          setStatusDialog(null);
          action?.();
        }}
      />

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-confirm-title"
        >
          <div className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Account</p>
            <h2 id="delete-account-confirm-title" className="mt-1 font-display text-lg font-extrabold text-foreground">
              Delete your account?
            </h2>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
              Reason: <span className="text-foreground">{selectedReasonLabel}</span>
              {reason === 'other' && otherReason.trim() ? (
                <> — {otherReason.trim()}</>
              ) : null}
            </p>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
              You won&apos;t be able to use LinkUp with this account after this step. This cannot be undone from the
              app.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 min-[425px]:mt-6 min-[425px]:grid-cols-2 min-[425px]:gap-3">
              <button
                type="button"
                disabled={busy === 'delete'}
                onClick={() => setConfirmOpen(false)}
                className="min-h-[44px] rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
              >
                Keep account
              </button>
              <button
                type="button"
                disabled={busy === 'delete'}
                onClick={() => void performDelete()}
                className="min-h-[44px] rounded-full border border-[#EF4444]/40 bg-white px-4 text-[14px] font-extrabold text-[#EF4444] transition hover:bg-red-50 disabled:opacity-50"
              >
                {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => router.push('/profile')}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-white px-4 text-[14px] font-extrabold text-foreground transition hover:bg-[#EDE8FF]/50"
      >
        <IoArrowBack size={18} aria-hidden />
        Back to profile
      </button>

      <header className="space-y-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Account</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Delete account</h1>
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          Before you go, you might not need to delete. Try one of these options first — you can always come back to
          this page later.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold text-foreground">Try this instead</h2>

        <article className="linkup-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IoPauseCircleOutline size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-extrabold text-foreground">Take a break</h3>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
              Hide your profile from Discover and new visitors. Your account, matches, and messages stay intact.
            </p>
            {profileHidden ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-700">
                <IoEyeOffOutline size={14} aria-hidden />
                Profile is currently hidden
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy !== null || profileHidden}
            onClick={() => void handleTakeABreak()}
            className={cn(
              'shrink-0 rounded-full px-5 py-2.5 text-[13px] font-extrabold transition',
              profileHidden
                ? 'cursor-default border border-border bg-[#F5F6FA] text-muted'
                : 'border border-primary/25 bg-white text-primary hover:bg-[#EDE8FF]/50 disabled:opacity-50'
            )}
          >
            {busy === 'hide' ? 'Hiding…' : profileHidden ? 'Hidden' : 'Hide my profile'}
          </button>
        </article>

        <article className="linkup-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
            <IoNotificationsOffOutline size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-extrabold text-foreground">Pause notifications</h3>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
              Turn off push and email alerts without losing your account. Re-enable anytime in settings.
            </p>
            {notificationsPaused ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-700">
                <IoNotificationsOffOutline size={14} aria-hidden />
                Notifications are paused
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy !== null || notificationsPaused}
            onClick={() => void handlePauseNotifications()}
            className={cn(
              'shrink-0 rounded-full px-5 py-2.5 text-[13px] font-extrabold transition',
              notificationsPaused
                ? 'cursor-default border border-border bg-[#F5F6FA] text-muted'
                : 'border border-primary/25 bg-white text-primary hover:bg-[#EDE8FF]/50 disabled:opacity-50'
            )}
          >
            {busy === 'pause' ? 'Pausing…' : notificationsPaused ? 'Paused' : 'Pause notifications'}
          </button>
        </article>

        <p className="text-[13px] font-semibold text-muted">
          Prefer fine-grained control?{' '}
          <Link href="/profile/notifications" className="font-extrabold text-primary underline">
            Notification settings
          </Link>{' '}
          ·{' '}
          <Link href="/profile/edit" className="font-extrabold text-primary underline">
            Edit profile
          </Link>
        </p>
      </section>

      <section className="linkup-card space-y-4 p-5">
        <h2 className="font-display text-lg font-extrabold text-foreground">Why are you leaving?</h2>
        <p className="text-[13px] font-semibold text-muted">Required if you continue with deletion.</p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Reason for leaving</legend>
          {DELETION_REASONS.map((option) => {
            const selected = reason === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition',
                  selected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-white hover:border-primary/20 hover:bg-[#FAFAFF]'
                )}
              >
                <input
                  type="radio"
                  name="deletion-reason"
                  value={option.id}
                  checked={selected}
                  onChange={() => setReason(option.id)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-[14px] font-extrabold text-foreground">{option.label}</span>
              </label>
            );
          })}
        </fieldset>
        {reason === 'other' ? (
          <Input
            label="Tell us more (optional but helpful)"
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            placeholder="What could we do better?"
          />
        ) : null}
      </section>

      <section className="linkup-card space-y-4 border-[#EF4444]/20 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EF4444]/10 text-[#EF4444]">
            <IoWarningOutline size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-foreground">Still want to delete?</h2>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
              Your account is suspended, your profile is hidden from Discover and messages, and premium access ends.
              Full data retention and purge follow our{' '}
              <Link href="/legal/privacy-policy" className="font-extrabold text-primary underline">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div>
          <p className="text-[14px] font-semibold text-muted">
            Type <span className="font-extrabold text-[#EF4444]">{CONFIRM_PHRASE}</span> to confirm
          </p>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={CONFIRM_PHRASE}
            className="mt-2"
          />
        </div>

        <button
          type="button"
          disabled={busy !== null}
          onClick={handleDeletePress}
          className={cn(
            'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-extrabold text-white transition',
            canSubmit && reasonReady && busy === null
              ? 'bg-gradient-to-r from-[#EF4444] to-secondary hover:opacity-95'
              : 'cursor-not-allowed bg-border text-white/80'
          )}
        >
          <IoTrashOutline size={18} aria-hidden />
          {busy === 'delete' ? 'Processing…' : 'Delete my account'}
        </button>
      </section>

      <p className="text-center text-[13px] font-semibold leading-relaxed text-muted">
        Changed your mind?{' '}
        <Link href="/profile" className="font-extrabold text-primary underline">
          Go back
        </Link>{' '}
        — nothing changes until you confirm and complete deletion.
      </p>
    </div>
  );
}
