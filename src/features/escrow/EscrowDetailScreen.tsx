'use client';

import { EscrowPaymentSuccessModal } from '@/components/escrow/EscrowPaymentSuccessModal';
import { EscrowConfirmModal } from '@/components/escrow/EscrowConfirmModal';
import { PaymentMethodDialog } from '@/components/escrow/PaymentMethodDialog';
import { EscrowCounterpartyHeader } from '@/components/escrow/EscrowCounterpartyHeader';
import { EscrowDetailSkeleton } from '@/components/escrow/EscrowDetailSkeleton';
import { EscrowFundCTA } from '@/components/escrow/EscrowFundCTA';
import { EscrowGroupHostShareBreakdownCard } from '@/components/escrow/EscrowGroupHostShareBreakdownCard';
import { EscrowNoticeBanner } from '@/components/escrow/EscrowNoticeBanner';
import {
  ESCROW_FOOTER_CLEARANCE,
  EscrowPaymentFooter,
} from '@/components/escrow/EscrowPaymentFooter';
import { EscrowScreenHeader } from '@/components/escrow/EscrowScreenHeader';
import { EscrowSinglePayerFundingCard } from '@/components/escrow/EscrowSinglePayerFundingCard';
import { EscrowSplitFundingCard } from '@/components/escrow/EscrowSplitFundingCard';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { EscrowStepIndicator } from '@/components/escrow/EscrowStepIndicator';
import { EscrowSummaryCard } from '@/components/escrow/EscrowSummaryCard';
import { EscrowTimeline } from '@/components/escrow/EscrowTimeline';
import { FundingDeadlineUrgencyBanner } from '@/components/escrow/FundingDeadlineUrgencyBanner';
import { OpenDisputeModal } from '@/components/escrow/OpenDisputeModal';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { SafetyCaveatInterstitial } from '@/components/plans/SafetyCaveatInterstitial';
import { EscrowPolicySignOffModal } from '@/components/plans/EscrowPolicySignOffModal';
import { hasEscrowPolicySignoff, needsSafetyCaveatGate } from '@/lib/groupPlan/annexureB';
import { useEscrowConfirmation } from '@/hooks/useEscrowConfirmation';
import { useEscrowFunding } from '@/hooks/useEscrowFunding';
import { useEscrowRealtime } from '@/hooks/useEscrowRealtime';
import { buildEscrowTimeline } from '@/lib/escrow/buildEscrowTimeline';
import { deriveEscrowStepActiveIndex } from '@/lib/escrow/deriveEscrowStepActiveIndex';
import {
  escrowAwaitingFulfillment,
  escrowCheckoutInitiator,
  escrowCheckoutReference,
  escrowCheckoutReturned,
  escrowPaymentInitiated,
} from '@/lib/escrow/escrowCheckoutMetadata';
import { hasEscrowPaymentAck, markEscrowPaymentAck } from '@/lib/escrow/escrowPaymentAck';
import {
  confirmMeetupComplete,
  openEscrowDisputeWithTicket,
  recordEscrowCheckoutReturned,
  releaseEscrowFunds,
} from '@/lib/escrow/escrowActions';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import {
  getUserEscrowBadgeDisplay,
  getUserPaymentStatusLabel,
  resolveCurrentUserPayCents,
  resolveEscrowRowLegAmountCents,
} from '@/lib/escrow/userEscrowPaymentDisplay';
import { formatEscrowMoney, isMeetupWithinHours, meetupHoursUntilLabel } from '@/lib/escrow/escrowPaymentPreview';
import {
  deriveEscrowPhase,
  derivePlanKind,
  deriveSplitRatioLabel,
  resolveEscrowScreenContent,
} from '@/lib/escrow/escrowScreenContent';
import { fetchEscrowDetail } from '@/lib/escrow/fetchEscrowDetail';
import { formatNGN, getReleaseRecipientLabel } from '@/lib/escrow/escrowFormatters';
import {
  escrowPaymentConfirmedMessage,
  isEscrowFullyFundedForMeet,
  userEscrowLegFunded,
} from '@/lib/escrow/splitEscrowFunding';
import { openPlanMeetupChatPathForPlanId } from '@/lib/messaging/openPlanMeetupChat';
import {
  isGhostHostEscrowRow,
  isGroupHostCloseEscrowRow,
  isGroupSplitPlan,
  resolveGroupHostShareBreakdown,
  type GroupSplitPlanSnapshot,
} from '@/lib/plans/groupDynamicSplit';
import {
  feeFromGrossAmountCents,
  grossAmountCents,
  patternBLegGrossCents,
  resolveEscrowLegFeeBreakdown,
} from '@/lib/plans/planFinancialConfig';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import {
  findGuestEscrowForBidder,
  guestEscrowStatusLabel,
  isGuestEscrowFunded,
} from '@/lib/plans/groupGuestEscrowDisplay';
import { resolveEscrowBackHref, resolvePlanAgreementHref } from '@/lib/plans/planAgreementRoute';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbEscrowTransaction, EscrowPattern } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoAlertCircle,
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircle,
  IoHourglassOutline,
  IoPeople,
  IoSparkles,
  IoSyncOutline,
  IoTimeOutline,
} from 'react-icons/io5';

function stepActiveIndex(
  escrow: DbEscrowTransaction,
  planStatus: string | null | undefined,
  escrowFullyFundedForMeet: boolean,
  hostViewingGuestLeg: boolean
): number {
  return deriveEscrowStepActiveIndex({
    escrowStatus: escrow.status,
    planStatus,
    escrowFullyFundedForMeet,
    hostViewingGuestLeg,
  });
}

function EscrowDetailContent({
  escrowId,
  agreementPlanId,
  agreementOfferId,
  escrowSource,
}: {
  escrowId: string;
  agreementPlanId?: string;
  agreementOfferId?: string;
  escrowSource?: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const { dbUser, subscriptionState } = useSubscriptionContext();
  const { fundEscrow, busy: fundBusy } = useEscrowFunding();
  const client = useMemo(() => createClient(), []);

  const [gateOpen, setGateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [fundConfirmOpen, setFundConfirmOpen] = useState(false);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'bank_transfer' | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);
  const [slaDeadline, setSlaDeadline] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [safetyCaveatOpen, setSafetyCaveatOpen] = useState(false);
  const [escrowPolicyOpen, setEscrowPolicyOpen] = useState(false);
  const [pendingFundAfterPolicy, setPendingFundAfterPolicy] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['escrow', escrowId, agreementPlanId ?? '', agreementOfferId ?? ''],
    enabled: !!escrowId && !authLoading && !!user?.id,
    queryFn: () =>
      fetchEscrowDetail(client, escrowId, user!.id, {
        planId: agreementPlanId ?? null,
        joinRequestId: agreementOfferId ?? null,
      }),
  });

  const escrow = data?.escrow ?? null;
  const names = data?.names ?? { hostName: 'Host', guestName: 'Guest' };
  const counterparty = data?.counterparty ?? null;
  const dispute = data?.dispute ?? null;
  const guestEscrowRows = data?.guestEscrowRows ?? [];
  const hostEscrowRow = data?.hostEscrowRow ?? null;
  const acceptedOffers = data?.acceptedOffers ?? [];
  const guestProfilesById = data?.guestProfilesById ?? {};

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  useEscrowRealtime(
    escrowId,
    useCallback(
      (next, prev) => {
        queryClient.setQueryData(['escrow', escrowId], (old: typeof data) => {
          if (!old) return old;
          return { ...old, escrow: { ...old.escrow, ...next } };
        });

        if (next.status === 'funded' && prev?.status !== 'funded') {
          showToast(escrowPaymentConfirmedMessage(next, user?.id).message);
        } else if (
          next.escrow_pattern === 'B' &&
          prev &&
          ((!prev.host_funded_at && next.host_funded_at) ||
            (!prev.guest_funded_at && next.guest_funded_at))
        ) {
          showToast(escrowPaymentConfirmedMessage(next, user?.id).message);
        }
      },
      [escrowId, queryClient, showToast, user?.id]
    )
  );

  useEffect(() => {
    const planId = escrow?.plan_id;
    if (!planId) return;
    const channel = client
      .channel(`escrow-plan-${planId}-${escrowId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, escrow?.plan_id, escrowId, queryClient]);

  useEffect(() => {
    const row = data?.escrow;
    const planId = row?.plan_id;
    if (!row || !planId || !user?.id) return;
    if (!isEscrowFullyFundedForMeet(row)) return;
    const counterpartyId =
      user.id === row.host_id ? row.guest_id : user.id === row.guest_id ? row.host_id : null;
    void needsSafetyCaveatGate(planId, user.id, counterpartyId).then((needs) => {
      if (needs) setSafetyCaveatOpen(true);
    });
  }, [data?.escrow, user?.id]);

  async function requestFundFlow() {
    if (!escrow?.plan_id) {
      setFundConfirmOpen(true);
      return;
    }
    const signed = await hasEscrowPolicySignoff(escrow.plan_id);
    if (!signed) {
      setPendingFundAfterPolicy(true);
      setEscrowPolicyOpen(true);
      return;
    }
    setFundConfirmOpen(true);
  }

  async function continueAfterEscrowPolicy() {
    setEscrowPolicyOpen(false);
    if (pendingFundAfterPolicy) {
      setPendingFundAfterPolicy(false);
      setFundConfirmOpen(true);
    }
  }

  useEffect(() => {
    if (!escrow || !user?.id) return;
    const planMeta = escrow.plans;
    if (
      !isGroupSplitPlan({
        is_group_plan: !!planMeta?.is_group_plan,
        escrow_pattern: (planMeta?.escrow_pattern ?? escrow.escrow_pattern) as 'A' | 'B' | 'C' | null,
      })
    ) {
      return;
    }
    if (user.id !== escrow.host_id) return;
    if (escrow.guest_id != null) return;
    const hostEscrowId = planMeta?.host_escrow_id;
    if (!hostEscrowId || escrow.id === hostEscrowId) return;
    if (!isGhostHostEscrowRow(planMeta ?? {}, escrow)) return;
    router.replace(
      `/escrow/${hostEscrowId}${agreementPlanId ? `?planId=${agreementPlanId}${agreementOfferId ? `&offerId=${agreementOfferId}` : ''}` : ''}`
    );
  }, [escrow, user?.id, agreementPlanId, agreementOfferId, router]);

  const checkoutRef = escrow ? escrowCheckoutReference(escrow) : null;

  const hostViewingGuestLeg = useMemo(() => {
    if (!escrow || !user?.id || user.id !== escrow.host_id) return false;
    const planMeta = escrow.plans;
    if (
      !isGroupSplitPlan({
        is_group_plan: !!planMeta?.is_group_plan,
        escrow_pattern: (planMeta?.escrow_pattern ?? escrow.escrow_pattern) as 'A' | 'B' | 'C' | null,
      })
    ) {
      return false;
    }
    return escrow.guest_id != null && !isGroupHostCloseEscrowRow(planMeta ?? {}, escrow);
  }, [escrow, user?.id]);

  const confirmPaymentEnabled = useMemo(() => {
    if (!escrow || !user?.id || hostViewingGuestLeg) return false;
    if (hasEscrowPaymentAck(escrowId)) return false;
    if (userEscrowLegFunded(escrow, user.id)) return false;
    if (
      escrow.status === 'funded' ||
      escrow.status === 'active' ||
      escrow.status === 'released'
    ) {
      return false;
    }
    if (escrow.status !== 'pending_funding') return false;
    if (!escrowAwaitingFulfillment(escrow)) return false;
    const initiator = escrowCheckoutInitiator(escrow);
    return (
      initiator === user.id ||
      (!initiator && getEscrowFundingUiState(escrow, user.id).canFund)
    );
  }, [escrow, escrowId, hostViewingGuestLeg, user?.id]);

  const onVerified = useCallback(() => {
    markEscrowPaymentAck(escrowId);
    void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
    setShowPaymentSuccess(true);
  }, [escrowId, queryClient]);

  const {
    status: confirmationStatus,
    secondsElapsed,
    retryVerify,
  } = useEscrowConfirmation(client, escrowId, {
    enabled: confirmPaymentEnabled,
    txRef: checkoutRef,
    viewerUserId: user?.id,
    onVerified,
  });

  useEffect(() => {
    if (!escrowId || !escrow || escrowCheckoutReturned(escrow)) return;
    if (!escrowPaymentInitiated(escrow)) return;

    function markReturned() {
      void recordEscrowCheckoutReturned(client, escrowId).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
      });
    }

    function onFocus() {
      markReturned();
    }

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [client, escrow, escrowId, queryClient]);

  async function onMessage() {
    if (!user?.id || !escrow?.plan_id) return;
    try {
      const path = await openPlanMeetupChatPathForPlanId(client, escrow.plan_id, user.id);
      router.push(path);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  async function onFund() {
    if (!user?.id || !escrow) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      setFundConfirmOpen(false);
      setPaymentMethodOpen(false);
      return;
    }
    setErrorMsg(null);
    const result = await fundEscrow(escrow, user.id, user.email, () => {
      void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
      showToast('Payment confirmed. Escrow updated.');
    });
    setFundConfirmOpen(false);
    setPaymentMethodOpen(false);
    if (!result.ok) setErrorMsg(result.error ?? 'Payment could not start');
  }

  function onFundConfirmContinue() {
    setFundConfirmOpen(false);
    setSelectedPaymentMethod(null);
    setPaymentMethodOpen(true);
  }

  function onPaymentMethodContinue() {
    if (!selectedPaymentMethod || !escrow) return;
    if (selectedPaymentMethod === 'card') {
      void onFund();
      return;
    }
    setPaymentMethodOpen(false);
    const planQuery = agreementPlanId ? `?planId=${encodeURIComponent(agreementPlanId)}` : '';
    router.push(`/escrow/${escrow.id}/bank-transfer${planQuery}`);
  }

  async function onConfirmComplete() {
    if (!user?.id || !escrow) return;
    if (!isEscrowFullyFundedForMeet(escrow)) {
      setErrorMsg(
        escrow.escrow_pattern === 'B'
          ? 'Both parties must fund their share before the meetup can proceed.'
          : 'Please fund escrow before proceeding.'
      );
      setCompleteOpen(false);
      return;
    }
    const planStatus = escrow.plans?.status;
    if (planStatus !== 'active' && planStatus !== 'completed') {
      setErrorMsg('The plan must be active before you can confirm the meetup.');
      setCompleteOpen(false);
      return;
    }
    setActionBusy(true);
    const { error: err } = await confirmMeetupComplete(client, escrow.plan_id, user.id);
    setActionBusy(false);
    setCompleteOpen(false);
    if (err) {
      setErrorMsg(err);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
    showToast('Meetup marked complete.');
  }

  async function onConfirmRelease() {
    if (!escrow) return;
    setActionBusy(true);
    const { data: planRow } = await client.from('plans').select('status').eq('id', escrow.plan_id).single();
    const { error: err } = await releaseEscrowFunds(
      client,
      escrow.id,
      escrow.plan_id,
      (planRow?.status as string | undefined) ?? escrow.plans?.status
    );
    setActionBusy(false);
    setReleaseOpen(false);
    if (err) {
      setErrorMsg(err);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    showToast('Funds released and wallet credited.');
  }

  async function onDisputeSubmit(reasonCode: string, reasonLabel: string, detail: string) {
    if (!user?.id || !escrow) return;
    setActionBusy(true);
    const result = await openEscrowDisputeWithTicket(client, {
      escrowId: escrow.id,
      planId: escrow.plan_id,
      userId: user.id,
      reasonCode,
      reasonLabel,
      detail,
    });
    setActionBusy(false);
    if (result.error) {
      setErrorMsg(result.error);
      return;
    }
    if (result.ticketId && subscriptionState.effectiveTier === 'PLATINUM') {
      const { data: ticket } = await client
        .from('support_tickets')
        .select('sla_deadline')
        .eq('id', result.ticketId)
        .single();
      setSlaDeadline((ticket?.sla_deadline as string) ?? null);
    }
    setDisputeSubmitted(true);
    void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
  }

  async function onCheckPaymentAgain() {
    if (!escrowId) return;
    setActionBusy(true);
    try {
      const funded = await retryVerify();
      if (funded) {
        markEscrowPaymentAck(escrowId);
        void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
        setShowPaymentSuccess(true);
      }
    } finally {
      setActionBusy(false);
    }
  }

  function handlePaymentSuccessContinue() {
    setShowPaymentSuccess(false);
    const planRow = escrow?.plans;
    if (!escrow?.plan_id || !planRow) return;
    router.push(
      resolvePlanAgreementHref(
        {
          id: escrow.plan_id,
          is_group_plan: planRow.is_group_plan ?? false,
          accepted_offer_id: agreementOfferId ?? null,
        },
        { offerId: agreementOfferId }
      )
    );
  }

  if (authLoading || isLoading) {
    return <EscrowDetailSkeleton />;
  }

  if (error || !escrow || !user?.id) {
    const backHref = resolveEscrowBackHref({
      planId: agreementPlanId,
      offerId: agreementOfferId,
      source: escrowSource,
    });
    const backLabel =
      escrowSource === 'plan' && agreementPlanId
        ? 'Back to meetup'
        : agreementPlanId
          ? 'Back to agreement'
          : 'Back to offers';
    return (
      <div className="mx-auto max-w-3xl">
      <div className="linkup-card px-6 py-10 text-center">
        <p className="font-extrabold text-foreground">Escrow not found</p>
          <p className="mt-2 text-[14px] font-semibold text-muted">
            {error instanceof Error ? error.message : 'This payment could not be loaded.'}
          </p>
          <Link href={backHref} className="mt-3 inline-block font-extrabold text-primary underline">
            {backLabel}
        </Link>
        </div>
      </div>
    );
  }

  const plan = escrow.plans;
  const pattern = (plan?.escrow_pattern ?? escrow.escrow_pattern) as EscrowPattern | null;
  const patternA = pattern === 'A';
  const patternB = pattern === 'B';
  const patternC = pattern === 'C';
  const planStatus = plan?.status;
  const backHref = resolveEscrowBackHref({
    planId: agreementPlanId ?? escrow.plan_id,
    offerId: agreementOfferId,
    source: escrowSource,
  });
  const isHost = user.id === escrow.host_id;
  const isGroupSplit = isGroupSplitPlan({
    is_group_plan: !!plan?.is_group_plan,
    escrow_pattern: pattern,
  });
  const planKind = derivePlanKind(plan ?? {});
  const myLegFunded = userEscrowLegFunded(escrow, user.id);
  const fundingUi = getEscrowFundingUiState(escrow, user.id);
  const isGroupHostLegRow =
    isGroupSplit && isHost && plan ? isGroupHostCloseEscrowRow(plan, escrow) : false;
  const isGhostHostRow =
    isGroupSplit && isHost && plan ? isGhostHostEscrowRow(plan, escrow) : false;
  const groupSplitPlanInput: GroupSplitPlanSnapshot | null = plan
    ? {
        total_amount_cents: plan.total_amount_cents,
        starting_price_cents: plan.starting_price_cents ?? null,
        agreed_price_cents: plan.agreed_price_cents ?? null,
        budget_min_cents: plan.budget_min_cents ?? null,
        budget_max_cents: plan.budget_max_cents ?? null,
        accepted_guest_amounts_sum_cents: plan.accepted_guest_amounts_sum_cents,
        current_suggested_share_cents: plan.current_suggested_share_cents ?? null,
        max_guests: plan.max_guests ?? undefined,
        accepted_guest_count: plan.accepted_guest_count ?? undefined,
        host_escrow_id: plan.host_escrow_id,
        group_closed_at: plan.group_closed_at,
      }
    : null;
  const groupHostShareResolveOpts = {
    acceptedOffers,
    hostEscrowRow,
  };
  const groupHostShareBreakdown =
    isGroupSplit && isHost && groupSplitPlanInput
      ? resolveGroupHostShareBreakdown(
          groupSplitPlanInput,
          escrow,
          guestEscrowRows,
          groupHostShareResolveOpts
        )
      : null;
  const groupHostShare = groupHostShareBreakdown;
  const resolvedHostShareDisplayCents = groupHostShare?.displayCents ?? 0;
  const resolvedHostSharePaymentCents = groupHostShare?.paymentCents ?? 0;
  const myShareCents =
    isGroupSplit && isHost
      ? hostViewingGuestLeg
        ? Math.max(0, escrow.guest_share_cents ?? escrow.amount_cents ?? 0)
        : resolvedHostShareDisplayCents > 0
          ? resolvedHostShareDisplayCents
          : (escrow.host_share_cents ?? 0)
      : isHost
        ? (escrow.host_share_cents ?? fundingUi.payAmountCents ?? 0)
        : (escrow.guest_share_cents ?? fundingUi.payAmountCents ?? 0);
  const myPayShareCents =
    isGroupSplit && isHost && !hostViewingGuestLeg
      ? resolvedHostSharePaymentCents > 0
        ? resolvedHostSharePaymentCents
        : (fundingUi.payAmountCents ?? grossAmountCents(escrow.host_share_cents ?? 0))
      : isGroupSplit && !isHost
        ? (fundingUi.payAmountCents > 0
            ? fundingUi.payAmountCents
            : grossAmountCents(escrow.guest_share_cents ?? 0))
        : myShareCents;
  const canFundThisLeg =
    !isGhostHostRow &&
    (fundingUi.canFund ||
      (isGroupSplit &&
        isHost &&
        groupHostShare != null &&
        myPayShareCents > 0 &&
        isGroupHostLegRow &&
        !myLegFunded &&
        escrow.status === 'pending_funding'));
  const escrowFullyFunded = isEscrowFullyFundedForMeet(escrow);
  const escrowFunded =
    escrowFullyFunded || escrow.status === 'active' || escrow.status === 'released';
  const escrowPhase = deriveEscrowPhase({
    isGroupSplit,
    isHost,
    hostEscrowId: plan?.host_escrow_id ?? null,
    myEscrowStatus: escrow.status ?? null,
    planStatus: planStatus ?? null,
    planTier: plan?.is_paid ? 'paid' : 'free',
    userLegFunded: myLegFunded,
  });
  const screenContent = resolveEscrowScreenContent({
    screen: 'secure_payment',
    planTier: plan?.is_paid ? 'paid' : 'free',
    planKind,
    pattern,
    role: isHost ? 'host' : 'guest',
    phase: escrowPhase,
    isGroupSplit,
    splitRatioLabel: deriveSplitRatioLabel(plan?.host_contribution_bps),
    counterpartyName: isHost ? names.guestName : names.hostName,
    userLegFunded: myLegFunded,
  });
  const userPaymentConfirmed =
    myLegFunded || confirmationStatus === 'verified';
  const paymentConfirmedCopy =
    isGroupSplit && userPaymentConfirmed
      ? myLegFunded && !escrowFullyFunded
        ? {
            title: 'Your share funded',
            message: isHost
              ? 'Your payment is confirmed. The plan activates once all guest shares are funded.'
              : 'Your slot is secured. The plan activates after all guests and the host have funded their shares.',
          }
        : escrowPaymentConfirmedMessage(escrow, user.id)
      : escrowPaymentConfirmedMessage(escrow, user.id);
  const showPaymentConfirmedFooter =
    userPaymentConfirmed && escrowCheckoutReturned(escrow) && !escrowFunded;
  const confirmingPayment =
    confirmationStatus === 'polling' || confirmationStatus === 'timeout';
  const paymentPendingConfirmation =
    confirmPaymentEnabled &&
    !userPaymentConfirmed &&
    !escrowFunded &&
    (confirmationStatus === 'polling' ||
      confirmationStatus === 'timeout' ||
      escrowAwaitingFulfillment(escrow));
  const showFund =
    canFundThisLeg &&
    !hostViewingGuestLeg &&
    screenContent.showPaymentButton &&
    !paymentPendingConfirmation &&
    !showPaymentConfirmedFooter &&
    !escrowFunded &&
    (!isGroupSplit || !isHost || myPayShareCents > 0);
  const showWaitingCard =
    !confirmingPayment &&
    (screenContent.waitingCopy != null
      ? myLegFunded || !fundingUi.canFund
      : fundingUi.waitingForCounterparty);
  const stepIdx = stepActiveIndex(escrow, planStatus, escrowFullyFunded, hostViewingGuestLeg);
  const whenLabel = formatIsoDateTime(plan?.agreed_scheduled_at, plan?.scheduled_at ?? undefined);
  const locationLabel = plan?.agreed_location ?? plan?.location_label ?? 'Not set';
  const userPaymentStatusLabel = getUserPaymentStatusLabel(escrow, user.id, {
    confirmingPayment: paymentPendingConfirmation || confirmingPayment,
    hostName: names.hostName,
    guestName: names.guestName,
  });
  const userEscrowBadge = getUserEscrowBadgeDisplay(escrow, user.id, {
    confirmingPayment: paymentPendingConfirmation || confirmingPayment,
    hostName: names.hostName,
    guestName: names.guestName,
  });
  const summaryLegAmountCents = resolveEscrowRowLegAmountCents(escrow, {
    viewerId: user.id,
    groupHostShare,
    hostEscrowId: plan?.host_escrow_id ?? null,
    isHostCloseRow: isGroupHostLegRow,
  });
  const totalHeldLabel = formatEscrowMoney(summaryLegAmountCents, escrow.currency);
  const currentUserPayCents = resolveCurrentUserPayCents(escrow, user.id, {
    groupHostShare,
    hostEscrowId: plan?.host_escrow_id ?? null,
    isHostCloseRow: isGroupHostLegRow,
  });
  const userPayGrossCents =
    fundingUi.payAmountCents > 0 ? fundingUi.payAmountCents : currentUserPayCents;
  const checkoutBreakdown = resolveEscrowLegFeeBreakdown(escrow, user.id);
  const yourShareLabel =
    userPayGrossCents > 0 ? formatEscrowMoney(userPayGrossCents, escrow.currency) : null;
  const fundConfirmAmountLabel = yourShareLabel ?? formatEscrowMoney(escrow.amount_cents, escrow.currency);
  const planTitleSuffix = plan?.is_group_plan
    ? ' · Group Plan'
    : plan?.is_mood_plan
      ? ' · Mood Plan'
      : '';
  const meetupIso = plan?.agreed_scheduled_at ?? plan?.scheduled_at ?? null;
  const meetupSoonPending = escrow.status === 'pending_funding' && isMeetupWithinHours(meetupIso, 48);
  const meetupWhenLabel = meetupHoursUntilLabel(meetupIso);
  const trustNote =
    screenContent.trustNote ??
    'Your payment is secure and stays in escrow until you confirm the meetup completed successfully.';
  const fundCtaSubtitle = screenContent.fundCtaSubtitle
    ? yourShareLabel
      ? `Your share: ${yourShareLabel} · ${screenContent.fundCtaSubtitle}`
      : screenContent.fundCtaSubtitle
    : `Total held: ${formatEscrowMoney(escrow.amount_cents, escrow.currency)} via Flutterwave`;
  const fundCtaTitle = screenContent.fundCtaLabel ?? fundingUi.fundCtaTitle;
  const disputed = escrow.status === 'disputed';
  const showWaitingFunded = escrowFullyFunded && planStatus === 'active' && !disputed;
  const showReleaseBlock =
    escrowFullyFunded && escrow.status === 'funded' && planStatus === 'completed' && !disputed;
  const isParty = user.id === escrow.host_id || user.id === escrow.guest_id;
  const timelineItems = buildEscrowTimeline(escrow, plan, dispute, {
    host: names.hostName,
    guest: names.guestName,
  });
  const metadata = escrow.metadata as Record<string, unknown> | null;
  const autoReleased = metadata?.auto_released === true;
  const platformFee = escrow.platform_fee_cents ?? 0;
  const goodwillApplied = escrow.goodwill_applied_cents ?? 0;
  const netRelease = escrow.amount_cents - platformFee;
  const footerActive = showFund || paymentPendingConfirmation || showPaymentConfirmedFooter;
  const hostGuestPaymentEntries = acceptedOffers
    .filter((offer) => !!offer.bidder_id)
    .map((offer) => ({ bidderId: offer.bidder_id, key: offer.id }));
  const groupSplitTotalOpts = { acceptedOffers, hostEscrowRow };
  const planTotalCents = groupHostShareBreakdown?.planTotalCents ?? 0;
  const guestsCommittedCents = groupHostShareBreakdown?.guestsCommittedCents ?? 0;
  const hostShareDisplayCents = groupHostShareBreakdown?.displayCents ?? 0;
  const hostSharePayGrossCents = groupHostShareBreakdown?.paymentCents ?? 0;
  const hostSharePlatformFeeCents = groupHostShareBreakdown?.platformFeeCents ?? 0;
  const groupClosed = !!plan?.group_closed_at;
  const hostShareFunded =
    !!hostEscrowRow?.host_funded_at ||
    hostEscrowRow?.status === 'funded' ||
    hostEscrowRow?.status === 'active' ||
    hostEscrowRow?.status === 'released';
  const hostEscrowHref = plan?.host_escrow_id
    ? `/escrow/${plan.host_escrow_id}${agreementPlanId ? `?planId=${agreementPlanId}` : ''}`
    : null;
  const youLabel = patternB
    ? isGroupSplit
      ? fundingUi.canFund
        ? isHost
          ? 'Your host share is due'
          : 'Your agreed share is due'
        : 'Group split escrow'
      : fundingUi.canFund
        ? 'Your share is due'
        : 'Split escrow'
    : patternA
      ? fundingUi.canFund
        ? 'You are paying (host)'
        : fundingUi.waitingForCounterparty
          ? 'Waiting for host'
          : 'Host-funded escrow'
      : patternC
        ? fundingUi.canFund
          ? 'You are paying (guest)'
          : fundingUi.waitingForCounterparty
            ? 'Waiting for guest'
            : 'Guest-funded escrow'
        : fundingUi.canFund
          ? 'You are paying'
          : '';

  const leadTitle = showPaymentConfirmedFooter
    ? paymentConfirmedCopy.title
    : paymentPendingConfirmation
      ? 'Confirming payment'
      : showFund
        ? 'Complete payment'
        : escrowFunded
          ? 'Escrow funded'
          : 'Secure hold';
  const leadSub = showPaymentConfirmedFooter
    ? paymentConfirmedCopy.message
    : paymentPendingConfirmation
      ? 'Hang tight while we verify your Flutterwave payment and update escrow.'
      : showFund
        ? 'This is the payment screen. Flutterwave checkout opens when you tap below.'
        : escrowFunded
          ? 'Your payment is held securely until the meetup is confirmed.'
          : 'Track funding, meetup, and release in one place.';

  return (
    <div className={`mx-auto max-w-3xl space-y-4 sm:space-y-5 ${footerActive ? ESCROW_FOOTER_CLEARANCE : 'pb-8'}`}>
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
      {safetyCaveatOpen && escrow?.plan_id ? (
        <SafetyCaveatInterstitial
          planId={escrow.plan_id}
          onAcknowledged={() => setSafetyCaveatOpen(false)}
        />
      ) : null}
      {escrowPolicyOpen && escrow?.plan_id ? (
        <EscrowPolicySignOffModal
          planId={escrow.plan_id}
          escrowPattern={escrow.escrow_pattern}
          onSigned={() => void continueAfterEscrowPolicy()}
        />
      ) : null}
      <EscrowConfirmModal
        open={fundConfirmOpen}
        title="Ready to pay?"
        message={`You'll pay ${fundConfirmAmountLabel} into escrow. Choose card checkout or bank transfer on the next step.`}
        confirmLabel="Continue"
        cancelLabel="Not now"
        onCancel={() => setFundConfirmOpen(false)}
        onConfirm={onFundConfirmContinue}
        confirmVariant="primary"
        busy={fundBusy}
      />
      <PaymentMethodDialog
        open={paymentMethodOpen}
        selected={selectedPaymentMethod}
        onSelect={setSelectedPaymentMethod}
        onContinue={onPaymentMethodContinue}
        onClose={() => setPaymentMethodOpen(false)}
        busy={fundBusy}
      />
      <EscrowConfirmModal
        open={completeOpen}
        title="Mark meetup complete?"
        message="Only confirm if the plan happened as agreed. The other person will be able to request fund release."
        confirmLabel="Yes, we completed it"
        cancelLabel="Cancel"
        onCancel={() => setCompleteOpen(false)}
        onConfirm={() => void onConfirmComplete()}
        busy={actionBusy}
      />
      <EscrowConfirmModal
        open={releaseOpen}
        title="Release funds?"
        message={`This pays out the held amount to the ${pattern === 'C' ? 'host' : 'guest'}. This cannot be undone from the app.`}
        confirmLabel="Release now"
        cancelLabel="Cancel"
        onCancel={() => setReleaseOpen(false)}
        onConfirm={() => void onConfirmRelease()}
        confirmVariant="danger"
        busy={actionBusy}
      />
      <OpenDisputeModal
        open={disputeOpen}
        loading={actionBusy}
        effectiveTier={subscriptionState.effectiveTier}
        slaDeadline={slaDeadline}
        disputeSubmitted={disputeSubmitted}
        onClose={() => {
          setDisputeOpen(false);
          setDisputeSubmitted(false);
          setSlaDeadline(null);
        }}
        onSubmit={(rid, lbl, d) => void onDisputeSubmit(rid, lbl, d)}
      />

      <EscrowScreenHeader backHref={backHref} />

      {toastMsg ? (
        <EscrowNoticeBanner tone="success" icon={<IoCheckmarkCircle size={20} />} title={toastMsg} />
      ) : null}
      {errorMsg ? (
        <EscrowNoticeBanner tone="danger" title="Something went wrong">
          {errorMsg}
        </EscrowNoticeBanner>
      ) : null}

      <section className="linkup-card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full linkup-gradient-primary" aria-hidden />
        <div className="pl-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Escrow</p>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {leadTitle}
          </h2>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">{leadSub}</p>
        </div>
      </section>

      {meetupSoonPending && meetupWhenLabel ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <IoTimeOutline size={20} className="shrink-0 text-amber-600" />
          <p className="text-[14px] font-semibold leading-relaxed text-amber-900">
            Meetup {meetupWhenLabel}. {showFund ? 'Fund escrow now' : 'Complete funding soon'} so you&apos;re
            covered.
          </p>
        </div>
      ) : null}

      {counterparty ? (
        <EscrowCounterpartyHeader
          title={`${plan?.title ?? 'Paid plan'}${planTitleSuffix}`}
          counterparty={counterparty}
          youLabel={youLabel}
        />
      ) : null}

      <button
        type="button"
        onClick={() => void onMessage()}
        className="group w-full rounded-full bg-gradient-to-r from-primary to-secondary p-[2px] transition hover:opacity-95"
      >
        <span className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-extrabold text-primary">
          <IoChatbubbleEllipsesOutline size={20} />
          Message {counterparty?.name ?? 'counterparty'}
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <EscrowStatusBadge status={userEscrowBadge.status} label={userEscrowBadge.label} />
        {plan?.is_group_plan ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
            <IoPeople className="text-blue-500" size={15} />
            <span className="text-[11px] font-extrabold text-blue-700">Group plan</span>
          </span>
        ) : null}
      </div>

      <EscrowStepIndicator activeIndex={stepIdx} />

      {screenContent.showMoodDeadlineBanner &&
      escrow.status === 'pending_funding' &&
      escrow.funding_deadline &&
      !disputed ? (
        <FundingDeadlineUrgencyBanner
          deadlineIso={escrow.funding_deadline}
          isMoodPlan={!!plan?.is_mood_plan}
        />
      ) : null}

      {disputed ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <IoAlertCircle size={22} className="shrink-0 text-red-600" />
          <p className="text-[14px] font-semibold leading-relaxed text-red-900">
            Dispute in progress. Payment actions are paused while we review.
          </p>
        </div>
      ) : null}

      <EscrowSummaryCard
        totalHeldLabel={totalHeldLabel}
        paymentStatusLabel={userPaymentStatusLabel}
        whenLabel={whenLabel}
        locationLabel={locationLabel}
        trustNote={trustNote}
        yourShareLabel={yourShareLabel}
      />

      {plan?.is_paid && checkoutBreakdown.grossCents > 0 ? (
        <div className="linkup-card space-y-2 p-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-muted">Plan contribution</span>
            <span className="font-extrabold text-foreground">
              {formatNGN(checkoutBreakdown.budgetCents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-muted">Platform fee (5%)</span>
            <span className="font-extrabold text-[#059669]">
              {formatNGN(checkoutBreakdown.feeCents)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[14px]">
            <span className="font-extrabold text-foreground">Total you pay</span>
            <span className="font-extrabold text-foreground">{formatNGN(checkoutBreakdown.grossCents)}</span>
          </div>
        </div>
      ) : null}

      {escrow.status === 'released' && goodwillApplied > 0 ? (
        <div className="linkup-card space-y-2 p-4">
          <p className="text-[13px] font-extrabold text-foreground">Fee breakdown</p>
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-muted">Platform fee</span>
            <span className="font-semibold text-muted line-through">
              {formatNGN(checkoutBreakdown.feeCents > 0 ? checkoutBreakdown.feeCents : feeFromGrossAmountCents(escrow.amount_cents))}
            </span>
          </div>
          <div className="flex items-center justify-between text-[14px]">
            <span className="flex items-center gap-1.5 font-semibold text-[#059669]">
              <IoSparkles size={14} />
              Goodwill credit applied
            </span>
            <span className="font-extrabold text-[#059669]">−{formatNGN(goodwillApplied)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[14px]">
            <span className="font-extrabold text-foreground">Fee charged</span>
            <span className="font-extrabold text-foreground">{formatNGN(platformFee)}</span>
          </div>
        </div>
      ) : null}

      {screenContent.showGroupHostCloseGuard ? (
        <section className="linkup-card space-y-4 p-5 text-center sm:p-6">
          <IoPeople size={22} className="mx-auto text-primary" />
          <p className="font-display text-lg font-extrabold text-foreground">Close the group first</p>
          <p className="mx-auto max-w-sm text-[14px] font-semibold leading-relaxed text-muted">
            Your share is calculated once you close the group. Go to Manage Offers to review your projected
            share and close the group.
          </p>
          {groupHostShare && groupHostShare.displayCents > 0 ? (
            <div className="rounded-xl border border-border/60 bg-white/80 px-4 py-3 text-left">
              <p className="text-[12px] font-semibold text-muted">Your projected host share</p>
              <p className="font-display text-xl font-extrabold text-primary">
                {formatEscrowMoney(groupHostShare.displayCents, escrow.currency)}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-muted">
                Plan total minus what accepted guests have committed so far.
              </p>
            </div>
          ) : null}
          <Link
            href={`/plan/${escrow.plan_id}/negotiate`}
            className="inline-flex w-full max-w-xs items-center justify-center rounded-full border border-primary/25 px-6 py-3 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 sm:w-auto"
          >
            Go to Manage Offers
          </Link>
        </section>
      ) : null}

      {screenContent.showPatternCard &&
      escrow.status === 'pending_funding' &&
      !confirmingPayment &&
      isGroupSplit &&
      !hostViewingGuestLeg ? (
        <section className="linkup-card space-y-3 p-5 sm:p-6">
          {screenContent.patternCardKicker ? (
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
              {screenContent.patternCardKicker}
            </p>
          ) : null}
          <p className="font-display text-lg font-extrabold text-foreground">{screenContent.patternCardTitle}</p>
          <p className="text-[14px] font-semibold leading-relaxed text-muted">{screenContent.patternCardBody}</p>
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold text-muted">
                {screenContent.patternLegHostLabel ?? (isHost ? 'Your host share' : 'Your agreed share')}
              </p>
              <p className="font-display text-xl font-extrabold text-primary">
                {formatEscrowMoney(userPayGrossCents, escrow.currency)}
              </p>
              {!isHost ? (
                <p className="mt-1 text-[13px] font-semibold text-muted">Negotiated and agreed with the host.</p>
              ) : null}
            </div>
            {myLegFunded ? (
              <IoCheckmarkCircle size={20} className="shrink-0 text-emerald-600" />
            ) : (
              <IoHourglassOutline size={20} className="shrink-0 text-muted" />
            )}
          </div>
          <p className="text-[13px] font-semibold text-muted">
            {myLegFunded ? 'Paid' : 'Pending your payment'}
          </p>
          {escrow.funding_deadline ? (
            <p className="text-[13px] font-semibold text-muted">
              Fund by {formatIsoDateTime(escrow.funding_deadline)}
            </p>
          ) : null}
        </section>
        ) : null}

      {hostViewingGuestLeg && !confirmingPayment ? (
        <div className="space-y-4">
          <section className="linkup-card space-y-3 p-5 sm:p-6">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
              Group plan · guest escrow
            </p>
            <p className="font-display text-lg font-extrabold text-foreground">
              {names.guestName}&apos;s secure hold
            </p>
            <p className="text-[14px] font-semibold leading-relaxed text-muted">
              Track this guest&apos;s funding status here. Your host payment is on a separate escrow leg.
            </p>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold text-muted">Guest agreed share</p>
                <p className="font-display text-xl font-extrabold text-primary">
                  {formatEscrowMoney(
                    Math.max(0, escrow.guest_share_cents ?? escrow.amount_cents ?? 0),
                    escrow.currency
                  )}
                </p>
              </div>
              {escrow.guest_funded_at ? (
                <IoCheckmarkCircle size={20} className="shrink-0 text-emerald-600" />
              ) : (
                <IoHourglassOutline size={20} className="shrink-0 text-muted" />
              )}
            </div>
        <p className="text-[13px] font-semibold text-muted">
              {escrow.guest_funded_at ? 'Funded' : 'Awaiting guest payment'}
            </p>
          </section>

          <EscrowGroupHostShareBreakdownCard
            planTotalCents={planTotalCents}
            guestsCommittedCents={guestsCommittedCents}
            hostShareCents={hostShareDisplayCents}
            hostPayGrossCents={hostSharePayGrossCents}
            platformFeeCents={hostSharePlatformFeeCents}
            currency={escrow.currency}
            groupClosed={groupClosed}
            hostShareFunded={hostShareFunded}
            hostEscrowHref={hostEscrowHref}
          />

          {isHost && hostGuestPaymentEntries.length > 0 ? (
            <HostGuestPaymentsList
              entries={hostGuestPaymentEntries}
              guestEscrowRows={guestEscrowRows}
              guestProfilesById={guestProfilesById}
              planPaid={!!plan?.is_paid}
            />
          ) : null}
        </div>
      ) : null}

      {isHost && !hostViewingGuestLeg && hostGuestPaymentEntries.length > 0 ? (
        <HostGuestPaymentsList
          entries={hostGuestPaymentEntries}
          guestEscrowRows={guestEscrowRows}
          guestProfilesById={guestProfilesById}
          planPaid={!!plan?.is_paid}
        />
      ) : null}

      {screenContent.showPatternCard &&
      screenContent.showPatternLegCards &&
      escrow.status === 'pending_funding' &&
      !confirmingPayment &&
      !isGroupSplit ? (
        <EscrowSplitFundingCard
          hostShareCents={patternBLegGrossCents(escrow, 'host')}
          guestShareCents={patternBLegGrossCents(escrow, 'guest')}
          hostFunded={!!escrow.host_funded_at}
          guestFunded={!!escrow.guest_funded_at}
          currency={escrow.currency}
          fundingDeadlineIso={escrow.funding_deadline}
          currentUserIsHost={isHost}
          kicker={screenContent.patternCardKicker ?? undefined}
          title={screenContent.patternCardTitle ?? undefined}
          sub={screenContent.patternCardBody ?? undefined}
          hostLegLabel={screenContent.patternLegHostLabel ?? undefined}
          guestLegLabel={screenContent.patternLegGuestLabel ?? undefined}
        />
      ) : null}

      {confirmPaymentEnabled && confirmingPayment ? (
        <div className="linkup-card flex items-start gap-3 p-5">
          <IoSyncOutline size={22} className="shrink-0 animate-spin text-primary" />
          <div>
            <p className="font-extrabold text-foreground">Verifying your payment</p>
            <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">
              This usually takes a few seconds. The fund button will disappear once escrow is confirmed.
            </p>
          </div>
        </div>
      ) : null}

      {fundingUi.showSinglePayerCard &&
      escrow.status === 'pending_funding' &&
      !confirmingPayment &&
      !hostViewingGuestLeg ? (
        <EscrowSinglePayerFundingCard
          pattern={patternC ? 'C' : 'A'}
          amountCents={escrow.amount_cents}
          currency={escrow.currency}
          fundingDeadlineIso={escrow.funding_deadline}
          payerLabel={patternA ? `${names.hostName} (host)` : `${names.guestName} (guest)`}
          isCurrentUserPayer={fundingUi.canFund}
          payerFunded={myLegFunded}
          isMoodPlan={!!plan?.is_mood_plan}
          kicker={screenContent.patternCardKicker ?? undefined}
          title={screenContent.patternCardTitle ?? undefined}
          sub={screenContent.patternCardBody ?? undefined}
        />
      ) : null}

      {escrowFullyFunded && (patternA || patternC) ? (
        <div className="linkup-card flex items-start gap-3 p-5">
          <IoCheckmarkCircle size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-extrabold text-foreground">Payment complete</p>
            <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">
              Escrow is funded and held until you confirm the meetup happened as agreed.
            </p>
          </div>
        </div>
      ) : null}

      {patternB && escrow.status === 'pending_funding' && escrowFullyFunded && !isGroupSplit ? (
        <div className="linkup-card flex items-start gap-3 p-5">
          <IoCheckmarkCircle size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-extrabold text-foreground">Both shares funded</p>
            <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">
              Escrow is fully funded and held until you confirm the meetup happened as agreed.
            </p>
          </div>
        </div>
      ) : null}

      {showWaitingCard ? (
        <div className="linkup-card flex items-start gap-3 p-5">
          <IoHourglassOutline size={22} className="shrink-0 text-primary" />
          <div>
            <p className="font-extrabold text-foreground">
              {screenContent.waitingTitle ?? fundingUi.waitingTitle ?? 'Waiting for the other person'}
            </p>
            <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">
              {screenContent.waitingCopy ??
                fundingUi.waitingSubtitle ??
                "You'll both get confirmation when escrow is fully funded."}
            </p>
          </div>
        </div>
      ) : null}

      <EscrowTimeline items={timelineItems} />

      {showWaitingFunded && isParty ? (
        <section className="linkup-card space-y-3 p-5 sm:p-6">
          <IoHourglassOutline size={22} className="text-primary" />
          <p className="font-display text-lg font-extrabold text-foreground">Waiting for plan completion</p>
          <p className="text-[14px] font-semibold leading-relaxed text-muted">
            When you&apos;ve met in person and everything matches what you agreed, confirm below. Then funds
            can be released.
          </p>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => setCompleteOpen(true)}
            className="w-full rounded-full border border-primary/30 py-3 text-[14px] font-extrabold text-primary disabled:opacity-50"
          >
            Confirm meetup complete
          </button>
          <button
            type="button"
            onClick={() => setDisputeOpen(true)}
            className="w-full py-2 text-[14px] font-extrabold text-red-700"
          >
            Open dispute
          </button>
        </section>
      ) : null}

      {showReleaseBlock && isParty ? (
        <div className="space-y-3">
          <EscrowFundCTA
            title="Release funds"
            subtitle="Meetup marked complete. Release when you're satisfied."
            onPress={() => setReleaseOpen(true)}
            disabled={actionBusy}
            loading={actionBusy}
          />
          <button
            type="button"
            onClick={() => setDisputeOpen(true)}
            disabled={actionBusy}
            className="w-full py-2 text-[14px] font-extrabold text-red-700 disabled:opacity-50"
          >
            Report issue
          </button>
        </div>
      ) : null}

      {escrow.status === 'funded' && !disputed && !showWaitingFunded && !showReleaseBlock && isParty ? (
        <button
          type="button"
          onClick={() => setDisputeOpen(true)}
          className="w-full py-2 text-[14px] font-extrabold text-red-700"
        >
          Open dispute
        </button>
      ) : null}

      {escrow.status === 'released' && autoReleased ? (
        <EscrowNoticeBanner tone="neutral" icon={<IoTimeOutline size={20} />} title="Automatically released">
          Funds were automatically released 24 hours after plan completion as no dispute was raised.
        </EscrowNoticeBanner>
      ) : null}

      {escrow.status === 'released' && !autoReleased ? (
        <section className="linkup-card space-y-3 p-5 text-center sm:p-6">
          <IoCheckmarkCircle size={28} className="mx-auto text-emerald-600" />
          <p className="font-display text-lg font-extrabold text-foreground">Funds released</p>
          <p className="text-[14px] font-semibold leading-relaxed text-muted">
            {getReleaseRecipientLabel(pattern, names.hostName, names.guestName)}.{' '}
            <span className="font-extrabold text-foreground">{formatNGN(netRelease)}</span> has been added to
            their wallet. Thanks for using LinkUp escrow.
          </p>
          <Link
            href="/support"
            className="inline-flex items-center justify-center rounded-full border border-primary/25 px-6 py-3 text-[14px] font-extrabold text-primary"
          >
            Contact support
          </Link>
      </section>
      ) : null}

      <EscrowPaymentFooter
        showFund={showFund}
        fundTitle={fundBusy ? 'Please wait…' : fundCtaTitle}
        fundSubtitle={fundCtaSubtitle}
        onFundPress={() => void requestFundFlow()}
        fundDisabled={fundBusy || confirmingPayment}
        fundLoading={fundBusy}
        paymentPendingConfirmation={paymentPendingConfirmation}
        showPaymentConfirmedFooter={showPaymentConfirmedFooter}
        paymentConfirmedCopy={paymentConfirmedCopy}
        confirmationTimeout={confirmationStatus === 'timeout'}
        secondsElapsed={secondsElapsed}
        checkAgainBusy={actionBusy}
        onCheckAgain={() => void onCheckPaymentAgain()}
        planId={escrow.plan_id}
      />

      {showPaymentSuccess ? (
        <EscrowPaymentSuccessModal
          message="Your payment has been verified and your escrow is now funded."
          continueLabel="View agreement"
          onContinue={handlePaymentSuccessContinue}
        />
      ) : null}
    </div>
  );
}

function HostGuestPaymentsList({
  entries,
  guestEscrowRows,
  guestProfilesById,
  planPaid,
}: {
  entries: Array<{ bidderId: string; key: string }>;
  guestEscrowRows: DbEscrowTransaction[];
  guestProfilesById: Record<string, { display_name: string | null; avatar_url: string | null }>;
  planPaid: boolean;
}) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Guest payments</p>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
        {entries.map((entry) => {
          const escrowRow = findGuestEscrowForBidder(guestEscrowRows, entry.bidderId);
          const funded = isGuestEscrowFunded(escrowRow, entry.bidderId);
          const statusLabel = guestEscrowStatusLabel(escrowRow, entry.bidderId, planPaid);
          const profile = guestProfilesById[entry.bidderId];
          const displayName = profile?.display_name?.trim() || null;
          const avatarUrl = profile?.avatar_url ?? null;

          return (
            <div key={entry.key} className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#EDE8FF]/50">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[13px] font-extrabold text-primary">
                    {displayName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold text-foreground">
                  {displayName ?? 'Guest'}
                </p>
                <p className="text-[12px] font-semibold text-muted">{statusLabel}</p>
              </div>
              <span
                className={[
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                  funded ? 'bg-emerald-50 text-emerald-700' : 'bg-[#EDE8FF]/60 text-primary',
                ].join(' ')}
              >
                {funded ? 'Funded' : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EscrowDetailScreen({
  escrowId,
  agreementPlanId,
  agreementOfferId,
  escrowSource,
}: {
  escrowId: string;
  agreementPlanId?: string;
  agreementOfferId?: string;
  escrowSource?: string | null;
}) {
  return (
    <Suspense fallback={<EscrowDetailSkeleton />}>
      <EscrowDetailContent
        escrowId={escrowId}
        agreementPlanId={agreementPlanId}
        agreementOfferId={agreementOfferId}
        escrowSource={escrowSource}
      />
    </Suspense>
  );
}
