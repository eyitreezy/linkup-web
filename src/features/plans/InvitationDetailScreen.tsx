'use client';

import { PlanSummaryCard } from '@/components/plans/agreement/PlanSummaryCard';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { planNegotiateHref } from '@/lib/plans/negotiateRoute';
import { respondToInvitation, type PlanInvitationRow } from '@/lib/plans/planInvitations';
import { createClient } from '@/lib/supabase/client';
import type { DbPlan } from '@/types/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { IoShieldCheckmarkOutline, IoTimeOutline } from 'react-icons/io5';

const DECLINE_REASONS = [
  'I can no longer make it',
  'Schedule conflict',
  'Budget constraints',
  'Personal reasons',
  'Found alternative plans',
  'Other',
] as const;

type DeclineReason = (typeof DECLINE_REASONS)[number];

type Props = {
  invitation: PlanInvitationRow;
  plan: DbPlan;
  hostName: string | null;
  hostAvatar: string | null;
  isKycApproved: boolean;
};

export function InvitationDetailClient({
  invitation: initialInvitation,
  plan,
  hostName,
  hostAvatar,
  isKycApproved,
}: Props) {
  const router = useRouter();
  const [invitation, setInvitation] = useState(initialInvitation);
  const [isResponding, setIsResponding] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason | null>(null);
  const [declineOther, setDeclineOther] = useState('');
  const [statusDialog, setStatusDialog] = useState<{
    title: string;
    message: string;
    variant?: 'error' | 'info';
  } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('plan_invitations')
      .select('*')
      .eq('id', initialInvitation.id)
      .maybeSingle();
    if (data) setInvitation(data as PlanInvitationRow);
  }, [initialInvitation.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`plan-invitation-web-${initialInvitation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_invitations',
          filter: `id=eq.${initialInvitation.id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initialInvitation.id, load]);

  const isExpired =
    invitation.status === 'expired' || new Date(invitation.expires_at).getTime() < Date.now();

  const msLeft = new Date(invitation.expires_at).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60)));
  const expiryLabel =
    hoursLeft <= 0
      ? 'Expired'
      : hoursLeft < 24
        ? `${hoursLeft}h left`
        : `${Math.ceil(hoursLeft / 24)}d left`;

  const shareLabel = resolveJoinRequestSlotCentsLabel(plan);
  const hostLabel = hostName?.trim() || 'Your host';

  function handleRespondError(msg: string) {
    if (msg === 'KYC_REQUIRED') {
      setStatusDialog({
        title: 'Verification required',
        message: 'Complete your identity verification to accept this invitation.',
        variant: 'info',
      });
    } else if (msg === 'EXPIRED') {
      setStatusDialog({
        title: 'Invitation expired',
        message: 'This invitation is no longer valid.',
        variant: 'error',
      });
      router.replace('/discover');
    } else if (msg === 'PLAN_FULL') {
      setStatusDialog({
        title: 'Plan is full',
        message: 'All slots have been filled. You can no longer accept this invitation.',
        variant: 'error',
      });
    } else if (msg === 'ALREADY_RESPONDED') {
      setStatusDialog({
        title: 'Already responded',
        message: 'You have already responded to this invitation.',
        variant: 'info',
      });
      void load();
    } else {
      setStatusDialog({
        title: 'Could not respond',
        message: 'Something went wrong. Please try again or contact support.',
        variant: 'error',
      });
    }
  }

  async function handleRespond(action: 'accept' | 'decline') {
    setIsResponding(true);
    try {
      const result = await respondToInvitation(invitation.id, action);

      if (action === 'accept') {
        if (result.isNegotiable) {
          router.replace(
            planNegotiateHref(plan.id, {
              offerId: result.offerId,
            })
          );
        } else if (result.escrowId) {
          router.replace(`/escrow/${result.escrowId}`);
        } else {
          router.replace(`/plan/${plan.id}/agreement`);
        }
      } else {
        router.replace('/discover');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      handleRespondError(msg);
    } finally {
      setIsResponding(false);
    }
  }

  async function handleDeclineWithReason(reason: DeclineReason, other?: string) {
    setIsResponding(true);
    try {
      await respondToInvitation(
        invitation.id,
        'decline',
        reason,
        reason === 'Other' ? other : undefined
      );
      setShowDeclineModal(false);
      setDeclineReason(null);
      setDeclineOther('');
      router.replace('/discover');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setStatusDialog({
        title: 'Could not decline',
        message: msg && msg !== 'UNKNOWN_ERROR' ? msg : 'Something went wrong. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsResponding(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-2 sm:px-6">
      <PlanFlowHeader
        kicker="Invitation"
        title="You are invited"
        subtitle={plan.title}
        backHref={`/plan/${plan.id}`}
        backLabel="Back to plan"
      />

      <PlanSummaryCard
        planTitle={plan.title?.trim() || 'Meetup'}
        location={plan.location_label}
        whenLabel={formatPlanWhen(plan)}
        priceLabel={shareLabel || 'Formula share'}
        notes={plan.description}
      />

      <div className="linkup-card flex items-center gap-3 p-4">
        <ProfileAvatar
          profile={{ avatar_url: hostAvatar, primary_photo_url: null, photo_urls: null }}
          displayName={hostLabel}
          size={48}
        />
        <div>
          <p className="text-[12px] font-semibold text-muted">Invited by</p>
          <p className="text-[16px] font-extrabold text-foreground">{hostLabel}</p>
        </div>
      </div>

      {shareLabel ? (
        <div className="linkup-card space-y-1 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Your share if you join
          </p>
          <p className="text-2xl font-extrabold text-primary">{shareLabel}</p>
          {plan.is_negotiable !== false ? (
            <p className="text-[13px] font-semibold text-muted">
              This is the formula price. You can negotiate after accepting.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isExpired && invitation.status === 'pending' && hoursLeft > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <IoTimeOutline className="shrink-0 text-amber-600" size={16} />
          <p className="text-[13px] font-semibold text-amber-800">
            {expiryLabel === 'Expired'
              ? 'This invitation has expired.'
              : `Invitation expires in ${expiryLabel.replace(' left', '')}`}
          </p>
        </div>
      ) : null}

      {isExpired ? (
        <div className="rounded-xl bg-muted/10 p-3 text-center text-[13px] font-semibold text-muted">
          This invitation has expired.
        </div>
      ) : null}

      {!isKycApproved && !isExpired && invitation.status === 'pending' ? (
        <div className="space-y-2 rounded-xl border border-primary/15 bg-[#EDE8FF]/50 p-4">
          <div className="flex items-center gap-2">
            <IoShieldCheckmarkOutline className="text-primary" size={16} />
            <p className="text-[14px] font-extrabold text-foreground">Verification required</p>
          </div>
          <p className="text-[13px] font-semibold text-muted">
            Complete your identity verification to accept this invitation.
          </p>
          <Link href="/trust" className="inline-block text-[13px] font-extrabold text-primary underline">
            Verify now
          </Link>
        </div>
      ) : null}

      {!isExpired && invitation.status === 'pending' ? (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => void handleRespond('accept')}
            disabled={!isKycApproved || isResponding}
            className="flex min-h-[48px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 py-3 text-[15px] font-extrabold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isResponding ? 'Confirming…' : 'Accept invitation'}
          </button>
          <button
            type="button"
            onClick={() => setShowDeclineModal(true)}
            disabled={isResponding}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-5 py-2.5 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : null}

      {invitation.status === 'accepted' ? (
        <div className="rounded-xl bg-muted/10 p-3 text-center text-[13px] font-semibold text-muted">
          You accepted this invitation.
        </div>
      ) : null}

      {invitation.status === 'declined' ? (
        <div className="rounded-xl bg-muted/10 p-3 text-center text-[13px] font-semibold text-muted">
          You declined this invitation.
        </div>
      ) : null}

      {showDeclineModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-xl">
            <h3 className="font-display text-[18px] font-extrabold text-foreground">
              Why are you declining?
            </h3>
            <p className="mt-1 text-[13px] font-semibold text-muted">
              Your reason helps the host understand.
            </p>

            <div className="mt-4 space-y-2">
              {DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setDeclineReason(reason)}
                  className={[
                    'w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold transition',
                    declineReason === reason
                      ? 'border-primary bg-[#EDE8FF]/40 text-primary'
                      : 'border-border bg-white text-foreground hover:border-primary/30',
                  ].join(' ')}
                >
                  {reason}
                </button>
              ))}
            </div>

            {declineReason === 'Other' ? (
              <textarea
                value={declineOther}
                onChange={(e) => setDeclineOther(e.target.value)}
                placeholder="Please tell us more..."
                maxLength={300}
                rows={3}
                className="mt-3 w-full rounded-2xl border border-border bg-[#F8F9FC] px-4 py-3 text-[14px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineReason(null);
                  setDeclineOther('');
                }}
                className="flex-1 rounded-full border border-border py-3 text-[14px] font-extrabold text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!declineReason || isResponding}
                onClick={() => {
                  if (!declineReason) return;
                  void handleDeclineWithReason(
                    declineReason,
                    declineReason === 'Other' ? declineOther : undefined
                  );
                }}
                className="flex-1 rounded-full border border-red-200 bg-red-50 py-3 text-[14px] font-extrabold text-red-600 disabled:opacity-40"
              >
                {isResponding ? 'Declining...' : 'Confirm decline'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppStatusDialog
        open={statusDialog !== null}
        variant={statusDialog?.variant ?? 'error'}
        title={statusDialog?.title ?? ''}
        message={statusDialog?.message ?? ''}
        onClose={() => setStatusDialog(null)}
      />
    </div>
  );
}
