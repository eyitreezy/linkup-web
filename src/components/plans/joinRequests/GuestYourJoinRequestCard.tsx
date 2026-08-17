'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { RequestToJoinButton } from '@/components/plans/RequestToJoinButton';
import { joinRequestStatusChip } from '@/features/plans/planDetailUtils';
import {
  deriveGuestJoinRequestCardPhase,
  GUEST_JOIN_REQUEST_PENDING_COPY,
} from '@/lib/plans/guestJoinRequestCardState';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import type { PlanViewerContext } from '@/lib/plans/planViewerContext';
import type { DbPlan, JoinRequestStatus } from '@/types/database';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useState } from 'react';
import { IoWalletOutline } from 'react-icons/io5';

const actionPrimary =
  'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50';

type Props = {
  plan: DbPlan;
  planId: string;
  ctx: PlanViewerContext;
  myJoinRequest: { id: string; status: JoinRequestStatus } | null;
  listingExpired: boolean;
  onJoinSuccess?: () => void;
  onPlanExpired?: () => void;
  onPayShare: () => void;
};

export function GuestYourJoinRequestCard({
  plan,
  planId,
  ctx,
  myJoinRequest,
  listingExpired,
  onJoinSuccess,
  onPlanExpired,
  onPayShare,
}: Props) {
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const phase = deriveGuestJoinRequestCardPhase(ctx, myJoinRequest);
  const slotLabel = resolveJoinRequestSlotCentsLabel(plan);
  const statusChip =
    myJoinRequest?.status != null ? joinRequestStatusChip(myJoinRequest.status) : null;

  return (
    <section className="linkup-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="font-display text-lg font-extrabold text-foreground">Your request</h3>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          Track your join request and next step for this plan.
        </p>
      </div>

      <div className="px-4 py-6">
        {phase === 'can_request' ? (
          <div className="space-y-4">
            <AppEmptyState
              variant="compact"
              emoji="👋"
              title="No request yet"
              description="Request to join at the listed formula share. The host will review your request."
              className="border-0 bg-[#FAFAFF]/80 shadow-none"
            />
            <RequestToJoinButton
              planId={planId}
              suggestedAmountCents={plan.current_suggested_share_cents}
              currency={plan.currency ?? 'NGN'}
              planListingExpired={listingExpired}
              onPlanExpired={onPlanExpired}
              onSuccess={onJoinSuccess}
            />
          </div>
        ) : null}

        {phase === 'pending' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-[#FAFAFF]/80 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-foreground">Join request sent</p>
                  {slotLabel ? (
                    <p className="mt-1 text-[13px] font-semibold text-primary">{slotLabel}</p>
                  ) : null}
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">
                    Waiting for the host to approve your request.
                  </p>
                </div>
                {statusChip ? (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-extrabold',
                      statusChip.className
                    )}
                  >
                    {statusChip.label}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className={actionPrimary}
              onClick={() => setPendingDialogOpen(true)}
            >
              View request status
            </button>
          </div>
        ) : null}

        {phase === 'approved_pay' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-foreground">Request approved</p>
                  {slotLabel ? (
                    <p className="mt-1 text-[13px] font-semibold text-primary">{slotLabel}</p>
                  ) : null}
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">
                    Payment required to confirm your place on this plan.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                  Approved
                </span>
              </div>
            </div>
            <button type="button" className={actionPrimary} onClick={onPayShare}>
              <IoWalletOutline size={18} />
              Pay your share
              {ctx.payShareAmountLabel ? ` · ${ctx.payShareAmountLabel}` : ''}
            </button>
          </div>
        ) : null}

        {phase === 'approved_done' ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-extrabold text-foreground">You are on this plan</p>
                {slotLabel ? (
                  <p className="mt-1 text-[13px] font-semibold text-primary">{slotLabel}</p>
                ) : null}
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">
                  Your join request was approved and payment is complete.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                Confirmed
              </span>
            </div>
          </div>
        ) : null}

        {phase === 'declined' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-foreground">Request not approved</p>
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted">
                    The host did not approve your request for this plan.
                  </p>
                </div>
                {statusChip ? (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-extrabold',
                      statusChip.className
                    )}
                  >
                    {statusChip.label}
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              href="/discover"
              className="flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95"
            >
              Explore other plans
            </Link>
          </div>
        ) : null}

        {phase === 'closed' ? (
          <AppEmptyState
            variant="compact"
            emoji="🔒"
            title="Join requests closed"
            description="This plan is no longer accepting new join requests."
            className="border-0 bg-[#FAFAFF]/80 shadow-none"
          />
        ) : null}
      </div>

      <AppStatusDialog
        open={pendingDialogOpen}
        variant="info"
        title={GUEST_JOIN_REQUEST_PENDING_COPY.title}
        message={GUEST_JOIN_REQUEST_PENDING_COPY.message}
        onClose={() => setPendingDialogOpen(false)}
      />
    </section>
  );
}
