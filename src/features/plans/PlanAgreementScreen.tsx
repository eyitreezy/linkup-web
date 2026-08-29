'use client';

import { AgreementPageActionsBar, ACTIONS_BAR_CLEARANCE } from '@/components/plans/agreement/AgreementPageActionsBar';
import { AgreementEscrowStateCard } from '@/components/plans/agreement/AgreementEscrowStateCard';
import { AgreementPaymentPreviewCard } from '@/components/plans/agreement/AgreementPaymentPreviewCard';
import { HighValueEscrowNoticeCard } from '@/components/plans/agreement/HighValueEscrowNoticeCard';
import { MeetupFundingReminderBanner } from '@/components/plans/agreement/MeetupFundingReminderBanner';
import { PlanAgreementStatusBadge } from '@/components/plans/agreement/PlanAgreementStatusBadge';
import {
  PlanAgreementUserHeader,
  type AgreementParty,
} from '@/components/plans/agreement/PlanAgreementUserHeader';
import { PlanSummaryCard } from '@/components/plans/agreement/PlanSummaryCard';
import { PreAgreementReviewContent } from '@/components/plans/agreement/PreAgreementReviewContent';
import { PlanAgreementEmptyState, resolveAgreementEmptyReason } from '@/components/plans/agreement/PlanAgreementEmptyState';
import { PlanAgreementSkeleton } from '@/components/plans/agreement/PlanAgreementSkeleton';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { GroupEscrowStatusCard } from '@/components/escrow/GroupEscrowStatusCard';
import { GroupSplitAgreementSection } from '@/components/plans/group/GroupSplitAgreementSection';
import { HighValueEscrowModal } from '@/components/escrow/HighValueEscrowModal';
import { PlanEscrowPaymentCard } from '@/components/escrow/PlanEscrowPaymentCard';
import { CancellationSummaryCard } from '@/components/plans/CancellationSummaryCard';
import { GroupHostCancellationModal } from '@/components/plans/GroupHostCancellationModal';
import { EscrowPolicySignOffModal } from '@/components/plans/EscrowPolicySignOffModal';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { formatOfferAmount } from '@/features/plans/planDetailUtils';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import {
  getAgreementPaymentPreview,
  isMeetupWithinHours,
} from '@/lib/escrow/escrowPaymentPreview';
import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { openPlanMeetupChatPathForPlanId } from '@/lib/messaging/openPlanMeetupChat';
import {
  GOODWILL_TIER_MULTIPLIER,
  goodwillCreditCents,
  goodwillCreditCentsForTier,
} from '@/lib/plans/cancellationPolicy';
import { bothAgreementPartiesConfirmed } from '@/lib/plans/agreementConfirmations';
import { closeGroupAndCreateHostEscrow } from '@/lib/plans/closeGroupEscrow';
import { hasEscrowPolicySignoff } from '@/lib/groupPlan/annexureB';
import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import { isSyntheticJoinRequestOffer } from '@/lib/plans/joinRequestOffers';
import {
  deriveEscrowPhase,
  derivePlanKind,
  deriveSplitRatioLabel,
  resolveEscrowScreenContent,
} from '@/lib/escrow/escrowScreenContent';
import { confirmFreePlan, proceedToSecurePayment } from '@/lib/plans/planAgreementActions';
import { resolveAgreementEscrowId, resolveEscrowHref } from '@/lib/plans/planAgreementRoute';
import { agreementAlertMeta, formatAgreementAlertMessage } from '@/lib/plans/agreementAlertMeta';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { MAX_ESCROW_TIER1_CENTS, resolveEscrowLegGrossCents } from '@/lib/plans/planFinancialConfig';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { fetchPlanAgreementBundle } from '@/services/planAgreement.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IoClose } from 'react-icons/io5';

interface CancellationOutcome {
  goodwill_credit: number;
  guest_credit: number;
  host_credit: number;
  cancel_type: 'early' | 'late' | 'no_show';
  band: string | null;
}

type Props = { planId: string; offerId?: string; joinRequestId?: string };

function agreedPriceLabel(plan: DbPlan, offer: DbPlanOffer | null): string {
  const cents = plan.agreed_price_cents ?? offer?.amount_cents ?? plan.starting_price_cents;
  if (cents == null || cents <= 0) return 'Free plan';
  return formatOfferAmount(cents);
}

export function PlanAgreementScreen({ planId, offerId, joinRequestId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'free' | 'pay' | 'ack' | null>(null);
  const [highValueModal, setHighValueModal] = useState<'platinum' | 'self' | 'counterparty' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [hostGroupCancelOpen, setHostGroupCancelOpen] = useState(false);
  const [cancelOptionsOpen, setCancelOptionsOpen] = useState(false);
  const [noShowConfirmOpen, setNoShowConfirmOpen] = useState(false);
  const [mutualCancelOpen, setMutualCancelOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [cancellationOutcome, setCancellationOutcome] = useState<CancellationOutcome | null>(null);
  const [hasVotedMutualCancel, setHasVotedMutualCancel] = useState(false);
  const [mutualVoteCount, setMutualVoteCount] = useState(0);
  const [mutualToast, setMutualToast] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [showTermsWarning, setShowTermsWarning] = useState(false);
  const [statusAlert, setStatusAlert] = useState<{
    title: string;
    message: string;
    variant: 'error' | 'info';
  } | null>(null);
  const [escrowPolicyOpen, setEscrowPolicyOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);

  function showAgreementAlert(message: string) {
    const meta = agreementAlertMeta(message);
    setStatusAlert({
      title: meta.title,
      message: formatAgreementAlertMessage(message),
      variant: meta.variant,
    });
  }

  const { subscriptionState } = useSubscriptionContext();

  useEffect(() => {
    if (!legalOpen) setHasAgreed(false);
  }, [legalOpen]);

  const profileQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      if (bundle.error) throw new Error(bundle.error);
      return bundle;
    },
    enabled: !!user?.id,
  });

  const agreementQuery = useQuery({
    queryKey: ['plan-agreement', planId, offerId ?? '', joinRequestId ?? '', user?.id ?? ''],
    queryFn: async () => {
      const client = createClient();
      const res = await fetchPlanAgreementBundle(client, planId, {
        offerId: offerId ?? null,
        joinRequestId: joinRequestId ?? null,
        userId: user?.id ?? null,
      });
      if (res.error) throw new Error(res.error);
      if (!res.data) throw new Error('Agreement not available');
      return res.data;
    },
    enabled: !!user?.id,
    retry: false,
  });

  const invalidateAgreement = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['plan-agreement', planId] });
  }, [planId, queryClient]);

  const loadRef = useRef(invalidateAgreement);
  loadRef.current = invalidateAgreement;

  useEffect(() => {
    if (!planId || !user?.id) return;
    const client = createClient();
    const channel = client
      .channel(`plan-agreement-${planId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agreement_confirmations', filter: `plan_id=eq.${planId}` },
        () => loadRef.current()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
        () => loadRef.current()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'escrow_transactions', filter: `plan_id=eq.${planId}` },
        () => loadRef.current()
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [planId, user?.id]);

  const dbUser = profileQuery.data?.dbUser ?? null;
  const data = agreementQuery.data;
  const plan = data?.plan;
  const offer = data?.offer;
  const isHost = !!user?.id && plan?.creator_id === user.id;
  const isBidder = !!user?.id && offer?.bidder_id === user.id;
  const isGuest = isBidder;
  const participant = isHost || isBidder;

  useEffect(() => {
    if (!user?.id || !data?.mutualVoteIds) return;
    setMutualVoteCount(data.mutualVoteIds.length);
    setHasVotedMutualCancel(data.mutualVoteIds.includes(user.id));
  }, [data?.mutualVoteIds, user?.id]);

  useEffect(() => {
    if (!planId || !hasVotedMutualCancel) return;
    const client = createClient();
    const channel = client
      .channel(`plan-mutual-${planId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
        (payload) => {
          const next = payload.new as { status?: string };
          if (next.status === 'cancelled') {
            setMutualToast('Plan mutually cancelled. Refund processed.');
            setTimeout(() => router.push('/discover'), 1500);
          }
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [planId, hasVotedMutualCancel, router]);

  const paymentRequired = useMemo(() => {
    if (!plan || !offer) return false;
    return (plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0) > 0;
  }, [plan, offer]);

  const bothConfirmed = useMemo(
    () =>
      plan && offer && data
        ? bothAgreementPartiesConfirmed(data.confirmationUserIds, plan, offer)
        : false,
    [data, plan, offer]
  );

  const userConfirmed = user?.id ? data?.confirmationUserIds.includes(user.id) : false;

  const slotAccepted = offer?.status === 'accepted';
  const awaitingPay =
    plan?.status === 'awaiting_payment' || !!(plan?.is_group_plan && slotAccepted && paymentRequired);
  const needsConfirm =
    plan?.status === 'agreed' ||
    !!(plan?.is_group_plan && slotAccepted && !paymentRequired && plan?.status === 'negotiating');

  const viewerEscrow = useMemo(() => {
    if (!data || !user?.id) return null;
    if (isGroupSplitPlan(plan) && isHost) return data.hostEscrow ?? data.myEscrow ?? null;
    return data.myEscrow ?? null;
  }, [data, user?.id, plan, isHost]);

  const userLegFunded = useMemo(
    () => !!(viewerEscrow && user?.id && userEscrowLegFunded(viewerEscrow, user.id)),
    [viewerEscrow, user?.id]
  );

  const isPlanConfirmed = plan?.status === 'active' || plan?.status === 'completed';
  const showPaymentFlow = paymentRequired && !userLegFunded && !isPlanConfirmed;

  const hostParty = useMemo((): AgreementParty | null => {
    if (!data?.hostProfile) return null;
    return {
      userId: data.hostProfile.user_id,
      name: data.hostProfile.display_name?.trim() || 'Host',
      avatarUrl: data.hostProfile.avatar_url,
      verified: !!data.hostProfile.verified_badge,
    };
  }, [data?.hostProfile]);

  const guestParty = useMemo((): AgreementParty | null => {
    if (!data?.guestProfile) return null;
    return {
      userId: data.guestProfile.user_id,
      name: data.guestProfile.display_name?.trim() || 'Guest',
      avatarUrl: data.guestProfile.avatar_url,
      verified: !!data.guestProfile.verified_badge,
    };
  }, [data?.guestProfile]);

  function openLegalGate(action: 'free' | 'pay' | 'ack') {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setPendingAction(action);
    setLegalOpen(true);
  }

  async function onLegalConfirm() {
    if (!user?.id || !plan || !offer) return;
    setBusy(true);
    const client = createClient();
    const syntheticJoinOffer = isSyntheticJoinRequestOffer(plan);
    const { error } = await client.rpc('record_agreement_confirmation', {
      p_plan_id: plan.id,
      ...(plan.is_group_plan && offer.id && !syntheticJoinOffer ? { p_offer_id: offer.id } : {}),
    });
    if (error) {
      setBusy(false);
      showAgreementAlert(error.message);
      return;
    }
    const { data: refreshed } = await client
      .from('agreement_confirmations')
      .select('user_id')
      .eq('plan_id', plan.id);
    const ids = (refreshed ?? []).map((r) => r.user_id as string);
    const complete = bothAgreementPartiesConfirmed(ids, plan, offer);
    const action = pendingAction;
    setLegalOpen(false);
    setPendingAction(null);
    invalidateAgreement();
    if (complete) {
      if (action === 'free') await runConfirmFree();
      else if (action === 'pay' && user?.id) {
        if (isGroupSplitPlan(plan) && user.id === plan.creator_id) {
          await goToEscrowPayment();
        } else {
          const preview = getAgreementPaymentPreview(
            plan,
            offer.bidder_id,
            plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0,
            user.id
          );
          if (preview.userIsPayer) await runProceedPayment();
        }
      }
    }
    setBusy(false);
  }

  function handleLegalConfirmTap() {
    if (!hasAgreed) {
      setShowTermsWarning(true);
      return;
    }
    void onLegalConfirm();
  }

  async function runConfirmFree() {
    if (!plan) return;
    setBusy(true);
    const client = createClient();
    const { error } = await confirmFreePlan(client, plan.id);
    setBusy(false);
    if (error) showAgreementAlert(error);
    else router.push(`/plan/${planId}`);
  }

  async function runProceedPayment() {
    if (!plan || !offer) return;
    const targetEscrowId =
      plan && user?.id && data ? resolveAgreementEscrowId(plan, user.id, data) : null;
    if (targetEscrowId) {
      router.push(resolveEscrowHref(targetEscrowId, { planId, offerId: offer.id }));
      return;
    }
    setBusy(true);
    const client = createClient();
    const res = await proceedToSecurePayment(client, plan, offer);
    setBusy(false);
    if (res.error) {
      if (res.error === 'close_group_first') {
        const closed = await closeGroupAndCreateHostEscrow(client, plan.id);
        if (!closed.ok || !closed.hostEscrowId) {
          showAgreementAlert(closed.error ?? 'Close the group first in Manage Offers.');
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ['plan-agreement', planId] });
        router.push(resolveEscrowHref(closed.hostEscrowId, { planId, offerId: offer.id }));
        return;
      }
      if (res.error === 'high_value_requires_platinum') {
        setHighValueModal('platinum');
        return;
      }
      if (res.error === 'high_value_requires_kyc_tier3') {
        setHighValueModal('self');
        return;
      }
      if (res.error === 'high_value_counterparty_requires_kyc_tier3') {
        setHighValueModal('counterparty');
        return;
      }
      showAgreementAlert(res.error);
      return;
    }
    if (res.escrowId) router.push(resolveEscrowHref(res.escrowId, { planId, offerId: offer.id }));
  }

  async function goToEscrowPayment() {
    if (busy || !plan || !offer) return;
    if (payerBlockedByHighValue) {
      if (dbUser?.subscription_tier !== 'PLATINUM') {
        setHighValueModal('platinum');
      } else {
        setHighValueModal('self');
      }
      return;
    }
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    const targetEscrowId =
      plan && user?.id && data ? resolveAgreementEscrowId(plan, user.id, data) : null;
    if (targetEscrowId) {
      router.push(resolveEscrowHref(targetEscrowId, { planId, offerId: offer.id }));
      return;
    }
    if (isGroupSplitPlan(plan) && user?.id === plan.creator_id) {
      const client = createClient();
      const closed = await closeGroupAndCreateHostEscrow(client, plan.id);
      if (!closed.ok || !closed.hostEscrowId) {
        showAgreementAlert(closed.error ?? 'Close the group first in Manage Offers.');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['plan-agreement', planId] });
      router.push(resolveEscrowHref(closed.hostEscrowId, { planId, offerId: offer.id }));
      return;
    }
    if (offer.bidder_id && !(isGroupSplitPlan(plan) && user?.id === plan.creator_id)) {
      const client = createClient();
      const { data: escrowRow } = await client
        .from('escrow_transactions')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('guest_id', offer.bidder_id)
        .maybeSingle();
      if (escrowRow?.id) {
        router.push(resolveEscrowHref(escrowRow.id, { planId, offerId: offer.id }));
        return;
      }
    }
    const isGroupSplitParty =
      isGroupSplitPlan(plan) &&
      (user?.id === plan.creator_id || !isHost);

    if (!bothConfirmed && !isGroupSplitParty) {
      showAgreementAlert('Both parties must review and confirm the agreement before secure payment.');
      return;
    }
    const escrowSigned = await hasEscrowPolicySignoff(plan.id);
    if (!escrowSigned) {
      setPendingCheckout(true);
      setEscrowPolicyOpen(true);
      return;
    }
    await runProceedPayment();
  }

  async function continueAfterEscrowPolicy() {
    setEscrowPolicyOpen(false);
    if (pendingCheckout) {
      setPendingCheckout(false);
      await runProceedPayment();
    }
  }

  async function handleCancel({ noShow }: { noShow: boolean }) {
    if (!plan || busy) return;
    if (isHost && plan.is_group_plan) {
      setCancelOptionsOpen(false);
      setHostGroupCancelOpen(true);
      return;
    }
    setCancelOpen(false);
    setCancelOptionsOpen(false);
    setNoShowConfirmOpen(false);
    setBusy(true);
    const client = createClient();
    if (isHost) {
      await client
        .from('plan_offers')
        .update({ status: 'superseded' })
        .eq('plan_id', plan.id)
        .in('status', ['pending', 'countered']);
    }
    const { data: outcome, error } = await client.rpc('submit_plan_cancellation', {
      p_plan_id: planId,
      p_no_show: noShow,
    });
    setBusy(false);
    if (error) {
      showAgreementAlert(error.message);
      return;
    }
    setCancellationOutcome(outcome as CancellationOutcome);
    setOutcomeOpen(true);
  }

  function openHostCancelFlow() {
    if (!plan) return;
    if (isHost && plan.is_group_plan) {
      setHostGroupCancelOpen(true);
      return;
    }
    setCancelOpen(true);
  }

  function openGuestCancelFlow() {
    setCancelOptionsOpen(true);
  }

  async function handleVoteMutualCancel() {
    if (busy) return;
    setBusy(true);
    const client = createClient();
    const { data: voteData, error } = await client.rpc('vote_mutual_plan_cancel', { p_plan_id: planId });
    setBusy(false);
    if (error) {
      showAgreementAlert(error.message);
      return;
    }
    const result = voteData as { status?: string };
    if (result.status === 'completed') {
      setMutualCancelOpen(false);
      setMutualToast('Plan mutually cancelled. Refund processed.');
      setTimeout(() => router.push('/discover'), 1500);
      return;
    }
    setHasVotedMutualCancel(true);
    setMutualVoteCount((c) => Math.max(c, 1));
  }

  function dismissOutcome() {
    setOutcomeOpen(false);
    router.push('/discover');
  }

  async function onMessageCounterpart() {
    if (!user?.id || !plan || !offer) return;
    const otherUserId = isHost ? offer.bidder_id : hostParty?.userId ?? plan.creator_id;
    if (!otherUserId) {
      showAgreementAlert('Could not open chat');
      return;
    }
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, user.id, otherUserId);
      router.push(path);
    } catch (e) {
      showAgreementAlert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  async function onGoToPlanChat() {
    if (!user?.id || !plan) return;
    try {
      const client = createClient();
      const path = await openPlanMeetupChatPathForPlanId(client, planId, user.id);
      router.push(path);
    } catch (e) {
      showAgreementAlert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  if (!user || agreementQuery.isLoading || (!agreementQuery.data && agreementQuery.isFetching)) {
    return <PlanAgreementSkeleton />;
  }

  if (agreementQuery.isError || !plan || !offer) {
    return (
      <PlanAgreementEmptyState
        planId={planId}
        reason={resolveAgreementEmptyReason(agreementQuery.error, !!plan, !!offer)}
        planTitle={plan?.title}
      />
    );
  }

  if (plan.status === 'cancelled') {
    return <PlanAgreementEmptyState planId={planId} reason="cancelled" planTitle={plan.title} />;
  }

  if (!participant) {
    return (
      <PlanAgreementEmptyState planId={planId} reason="no_access" planTitle={plan.title} />
    );
  }

  const agreedAmount =
    plan.agreed_price_cents ?? offer.current_amount_cents ?? offer.amount_cents ?? 0;
  const whenLabel = formatIsoDateTime(
    plan.agreed_scheduled_at,
    plan.scheduled_at ?? offer.proposed_scheduled_at ?? undefined
  );
  const locationLabel = plan.agreed_location ?? plan.location_label;
  const notes = plan.agreed_notes ?? offer.message ?? null;
  const priceLabel = agreedPriceLabel(plan, offer);
  const showCancelPlan =
    !plan.is_group_plan && (needsConfirm || awaitingPay) && showPaymentFlow;
  const showMutualCancel = showCancelPlan && !plan.is_group_plan;
  const showHostGroupCancel =
    isHost &&
    !!plan.is_group_plan &&
    !['cancelled', 'completed'].includes(plan.status ?? '');
  const showGuestGroupCancel =
    isGuest &&
    !!plan.is_group_plan &&
    (needsConfirm || awaitingPay) &&
    showPaymentFlow;
  const showSingleGroupCancel = showHostGroupCancel || showGuestGroupCancel;
  const isGroupSplit = isGroupSplitPlan(plan);
  const isGroupSplitHost = isGroupSplit && isHost;
  const groupSplitGuestCanPay = isGroupSplit && !isHost;
  const escrowCents = paymentRequired
    ? (plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? null)
    : null;

  const screenPhase = deriveEscrowPhase({
    isGroupSplit,
    isHost,
    hostEscrowId: plan.host_escrow_id ?? null,
    myEscrowStatus: viewerEscrow?.status ?? null,
    planStatus: plan.status,
    planTier: paymentRequired ? 'paid' : 'free',
    userLegFunded,
  });

  const screenContent = resolveEscrowScreenContent({
    screen: legalOpen ? 'review' : 'agreement',
    planTier: paymentRequired ? 'paid' : 'free',
    planKind: derivePlanKind(plan),
    pattern: (plan.escrow_pattern as 'A' | 'B' | 'C') ?? null,
    role: isHost ? 'host' : 'guest',
    phase: screenPhase,
    isGroupSplit,
    splitRatioLabel: deriveSplitRatioLabel(plan.host_contribution_bps),
  });

  const paymentPreview =
    paymentRequired && escrowCents != null && escrowCents > 0 && user?.id
      ? getAgreementPaymentPreview(plan, offer.bidder_id, escrowCents, user.id)
      : null;
  const userPayGrossCents =
    viewerEscrow && user?.id
      ? resolveEscrowLegGrossCents(viewerEscrow, user.id) || null
      : null;
  const isSplitPlan = plan.escrow_pattern === 'B' && !isGroupSplit;
  const userIsPayer = paymentPreview?.userIsPayer ?? false;
  const existingEscrowId =
    plan && user?.id && data ? resolveAgreementEscrowId(plan, user.id, data) : null;
  const counterpartyPayerName = isHost ? guestParty?.name ?? 'Guest' : hostParty?.name ?? 'Host';
  const counterpartDisplay = counterpartyPayerName;
  const counterpartMessageName =
    counterpartDisplay.trim().split(/\s+/)[0] || counterpartDisplay;
  const guestTier = (subscriptionState.effectiveTier ?? 'FREE') as SubscriptionTier;
  const noShowGoodwillPreview = isGuest
    ? goodwillCreditCentsForTier(goodwillCreditCents(escrowCents ?? 0), guestTier)
    : 0;

  const isHighValue = escrowCents != null && escrowCents > MAX_ESCROW_TIER1_CENTS;
  const highValuePlatinum = dbUser?.subscription_tier === 'PLATINUM';
  const highValueTier3 = (dbUser?.kyc_tier ?? 1) >= 3;
  const highValueCounterpartyOk =
    plan.escrow_pattern !== 'C' || (data?.counterpartyKycTier ?? 1) >= 3;
  const highValueReady = !isHighValue || (highValuePlatinum && highValueTier3 && highValueCounterpartyOk);
  const payerBlockedByHighValue = isHighValue && userIsPayer && !highValueReady;

  const outcomeCardProps = cancellationOutcome
    ? {
        yourRefund: isGuest ? cancellationOutcome.guest_credit : cancellationOutcome.host_credit,
        goodwillCredit: cancellationOutcome.goodwill_credit,
        cancelType: cancellationOutcome.cancel_type,
      }
    : null;

  let primaryLabel = 'View plan';
  let onPrimary = () => router.push(`/plan/${planId}`);
  let primaryDisabled = false;

  if (isPlanConfirmed) {
    primaryLabel = 'Go to chat';
    onPrimary = () => void onGoToPlanChat();
  } else if (paymentRequired && userLegFunded) {
    primaryLabel = 'View plan';
    onPrimary = () => router.push(`/plan/${planId}`);
  } else if (awaitingPay && showPaymentFlow) {
    const otherName = isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host';
    if (isGroupSplitHost) {
      if (existingEscrowId) {
        primaryLabel = 'Complete secure payment';
        onPrimary = () => void goToEscrowPayment();
      } else {
        primaryLabel = 'Close group and pay';
        onPrimary = () => void goToEscrowPayment();
      }
      primaryDisabled = busy;
    } else if (userIsPayer) {
      if (!bothConfirmed && !groupSplitGuestCanPay) {
        if (!userConfirmed) {
          primaryLabel = 'Review terms & pay';
          onPrimary = () => openLegalGate('pay');
          primaryDisabled = busy;
        } else {
          primaryLabel = `Waiting for ${otherName}`;
          primaryDisabled = true;
          onPrimary = () => {};
        }
      } else if (payerBlockedByHighValue) {
        primaryLabel = 'Complete high-value requirements';
        onPrimary = () => void goToEscrowPayment();
      } else if (existingEscrowId) {
        primaryLabel = 'Complete secure payment';
        onPrimary = () => void goToEscrowPayment();
      } else {
      primaryLabel = 'Continue to secure payment';
        onPrimary = () => void goToEscrowPayment();
      }
    } else if (existingEscrowId) {
      primaryLabel = 'View payment status';
      onPrimary = () => router.push(resolveEscrowHref(existingEscrowId, { planId, offerId: offer.id }));
    } else {
      primaryLabel = `Waiting for ${counterpartyPayerName}`;
      primaryDisabled = true;
      onPrimary = () => {};
    }
  } else if (needsConfirm && showPaymentFlow) {
    const otherName = isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host';
    if (isGroupSplitHost) {
      if (existingEscrowId) {
        primaryLabel = 'Complete secure payment';
        onPrimary = () => void goToEscrowPayment();
      } else {
        primaryLabel = 'Close group and pay';
        onPrimary = () => void goToEscrowPayment();
      }
      primaryDisabled = busy;
    } else if (!userConfirmed) {
      if (!paymentRequired) {
        primaryLabel = 'Review & confirm plan';
        onPrimary = () => openLegalGate('free');
      } else if (userIsPayer) {
        primaryLabel = 'Review terms & pay';
        onPrimary = () => openLegalGate('pay');
      } else {
        primaryLabel = 'Review & confirm terms';
        onPrimary = () => openLegalGate('ack');
      }
      primaryDisabled = busy;
    } else if (!bothConfirmed && !groupSplitGuestCanPay) {
      primaryLabel = `Waiting for ${otherName}`;
      primaryDisabled = true;
      onPrimary = () => {};
    } else if (!paymentRequired) {
      primaryLabel = 'Confirm plan';
      onPrimary = () => void runConfirmFree();
      primaryDisabled = busy;
    } else if (userIsPayer) {
      primaryLabel = payerBlockedByHighValue ? 'Complete high-value requirements' : 'Proceed to secure payment';
      onPrimary = () => void goToEscrowPayment();
      primaryDisabled = busy && !payerBlockedByHighValue;
    } else if (existingEscrowId) {
      primaryLabel = 'View payment status';
      onPrimary = () => router.push(resolveEscrowHref(existingEscrowId, { planId, offerId: offer.id }));
    } else {
      primaryLabel = `Waiting for ${counterpartyPayerName}`;
      primaryDisabled = true;
      onPrimary = () => {};
    }
  }

  const leadSub =
    !showPaymentFlow && paymentRequired && userLegFunded
      ? 'Your payment is secured. We will notify you when the meetup is confirmed.'
      : screenContent.headerSubtitle ??
        (paymentRequired
          ? showPaymentFlow
            ? 'Review the summary below. Secure payment happens on the next screen, not while you negotiate.'
            : 'Review the meetup summary below.'
          : 'Review the meetup summary and confirm when you are ready.');

  const meetupIso = plan.agreed_scheduled_at ?? plan.scheduled_at ?? offer.proposed_scheduled_at ?? null;
  const meetupSoon =
    showPaymentFlow && paymentRequired && (needsConfirm || awaitingPay) && isMeetupWithinHours(meetupIso, 48);

  let paymentPreviewVariant: 'you_pay_next' | 'counterparty_pays' | 'split_you_pay' | 'split_waiting' | null =
    null;
  if (paymentPreview) {
    if (paymentPreview.pattern === 'B' && paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'split_you_pay';
    } else if (paymentPreview.pattern === 'B' && !paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'split_waiting';
    } else if (paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'you_pay_next';
    } else {
      paymentPreviewVariant = 'counterparty_pays';
    }
  }

  const statusSecondary = isPlanConfirmed
    ? "You're all set"
    : userLegFunded && paymentRequired
      ? 'Your payment is secured'
      : needsConfirm && showPaymentFlow
        ? bothConfirmed
          ? 'Both confirmed. Finalize in one step'
          : userConfirmed
            ? `Waiting for ${isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host'} to confirm`
            : 'Review details. Both people must confirm the summary'
        : awaitingPay && showPaymentFlow
          ? 'Awaiting secure payment'
          : "You're all set";

  const showEscrowStateCard =
    paymentRequired && (isPlanConfirmed || (userLegFunded && !isPlanConfirmed));

  const barPrimaryLabel = legalOpen ? 'Confirm and continue' : primaryLabel;
  const barOnPrimary = legalOpen ? handleLegalConfirmTap : onPrimary;
  const barPrimaryDisabled = legalOpen ? primaryDisabled || busy : primaryDisabled;

  return (
    <>
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
      {escrowPolicyOpen && plan ? (
        <EscrowPolicySignOffModal
          planId={plan.id}
          escrowPattern={plan.escrow_pattern}
          onSigned={() => void continueAfterEscrowPolicy()}
        />
      ) : null}
      <AppStatusDialog
        open={statusAlert !== null}
        title={statusAlert?.title ?? ''}
        message={statusAlert?.message ?? ''}
        variant={statusAlert?.variant ?? 'error'}
        buttonLabel="Got it"
        onClose={() => setStatusAlert(null)}
      />
      <AppStatusDialog
        open={showTermsWarning}
        title="Please review the terms"
        message="You need to read and agree to the plan terms and policy before proceeding to payment. Please check the box to confirm."
        variant="info"
        buttonLabel="Got it"
        onClose={() => setShowTermsWarning(false)}
      />
      <HighValueEscrowModal
        open={highValueModal !== null}
        variant={highValueModal ?? 'self'}
        onClose={() => setHighValueModal(null)}
      />
      {hostGroupCancelOpen ? (
        <GroupHostCancellationModal
          planId={planId}
          onCancelled={() => {
            setHostGroupCancelOpen(false);
            router.push('/discover');
          }}
          onDismiss={() => setHostGroupCancelOpen(false)}
        />
      ) : null}
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this plan?"
        message="Are you sure you want to cancel? The other person will be notified and this agreement will end."
        confirmLabel="Cancel plan"
        cancelLabel="Keep plan"
        confirmVariant="danger"
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void handleCancel({ noShow: false })}
      />
      <ConfirmDialog
        open={noShowConfirmOpen}
        title="Report host no-show?"
        message="This will be recorded. False reports may affect your account standing. Continue only if the host genuinely did not show up."
        confirmLabel="Report no-show"
        cancelLabel="Go back"
        confirmVariant="danger"
        busy={busy}
        onClose={() => setNoShowConfirmOpen(false)}
        onConfirm={() => void handleCancel({ noShow: true })}
      />
      {cancelOptionsOpen ? (
        <AgreementBottomSheet title="Why are you cancelling?" onClose={() => setCancelOptionsOpen(false)}>
              <button
                type="button"
                disabled={busy}
            onClick={() => void handleCancel({ noShow: false })}
            className="w-full rounded-2xl border border-border p-4 text-left transition hover:bg-[#F5F6FA] disabled:opacity-50"
              >
            <p className="text-[15px] font-extrabold text-foreground">I want to cancel</p>
            <p className="mt-1 text-[13px] font-semibold text-muted">
              Standard cancellation. See refund policy below
            </p>
              </button>
              <button
                type="button"
            disabled={busy}
                onClick={() => {
              setCancelOptionsOpen(false);
              setNoShowConfirmOpen(true);
            }}
            className="mt-2 w-full rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-left transition hover:bg-amber-100/80 disabled:opacity-50"
          >
            <p className="text-[15px] font-extrabold text-amber-800">The host didn&apos;t show up</p>
            <p className="mt-1 text-[13px] font-semibold text-amber-700">
              Report a no-show. Full refund
              {noShowGoodwillPreview > 0 ? (
                <>
                  {' '}
                  and up to {formatNGN(noShowGoodwillPreview)}
                  {guestTier !== 'FREE' && guestTier !== 'SILVER' ? (
                    <span className="text-muted">
                      {' '}
                      ({GOODWILL_TIER_MULTIPLIER[guestTier]}× {guestTier})
                    </span>
                  ) : null}{' '}
                  goodwill credit
                </>
              ) : null}
            </p>
          </button>
        </AgreementBottomSheet>
      ) : null}
      {mutualCancelOpen ? (
        <AgreementBottomSheet title="Mutual cancellation" onClose={() => setMutualCancelOpen(false)}>
          <p className="mb-4 text-[14px] font-semibold leading-relaxed text-muted">
            Both parties agree to cancel with a full refund to whoever funded escrow. No cancellation fees or strikes
            apply. The other person must also confirm.
          </p>
          <button
            type="button"
            disabled={busy || hasVotedMutualCancel}
            onClick={() => void handleVoteMutualCancel()}
            className="w-full rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            {hasVotedMutualCancel ? 'Waiting for the other person…' : 'I agree to mutual cancellation'}
          </button>
          {hasVotedMutualCancel && mutualVoteCount < 2 ? (
            <p className="mt-3 text-center text-[13px] font-semibold text-muted">
              Waiting for the other person to agree…
            </p>
          ) : null}
        </AgreementBottomSheet>
      ) : null}
      {outcomeOpen && outcomeCardProps ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-white p-5 shadow-xl">
            <CancellationSummaryCard
              outcome={outcomeCardProps}
              planType={plan?.is_group_plan ? 'group' : plan?.is_mood_plan ? 'mood' : 'standard'}
              escrowPattern={plan?.escrow_pattern ?? 'A'}
            />
            <button
              type="button"
              onClick={dismissOutcome}
              className="mt-4 w-full rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white"
            >
              Done
              </button>
          </div>
        </div>
      ) : null}

      <div className={cn('mx-auto max-w-3xl space-y-6', ACTIONS_BAR_CLEARANCE)}>
        {legalOpen ? (
          <>
            <PlanFlowHeader
              kicker="Agreement"
              title="Review & confirm"
              subtitle={
                screenContent.headerSubtitle ??
                'Both people confirm this summary before money moves. Outcomes are structured, transparent, and enforced on our servers.'
              }
              backLabel="Back to summary"
              onBackClick={() => setLegalOpen(false)}
            />
            <PreAgreementReviewContent
              planTitle={plan.title}
              whenLabel={whenLabel}
              locationLabel={locationLabel ?? null}
              priceLabel={priceLabel}
              userPayGrossCents={userPayGrossCents}
              currencyLabel={plan.currency ?? 'NGN'}
              patternCardTitle={screenContent.patternCardTitle}
              patternCardBody={screenContent.patternCardBody}
              showPaymentPreview={screenContent.showPaymentButton}
              isGroupSplit={isGroupSplit}
              isSplitPlan={isSplitPlan}
              agreed={hasAgreed}
              onAgreedChange={setHasAgreed}
            />
          </>
        ) : (
        <>
      <PlanFlowHeader
        kicker="Agreement"
            title="Confirm plan"
            subtitle={leadSub}
        backHref={`/plan/${planId}`}
      />

          {hostParty && guestParty ? (
            <div className="linkup-card p-6">
              <PlanAgreementUserHeader host={hostParty} guest={guestParty} />
            </div>
          ) : null}

          <PlanAgreementStatusBadge primary="Offer accepted" secondary={statusSecondary} />

          <PlanSummaryCard
            planTitle={plan.title}
            location={locationLabel ?? null}
            whenLabel={whenLabel}
            priceLabel={priceLabel}
            notes={notes}
          />

          {isGroupSplit && user?.id && showPaymentFlow ? (
            <GroupSplitAgreementSection
              plan={plan}
              planId={planId}
              userId={user.id}
              userEmail={user.email}
              isHost={!!isHost}
              myOffer={offer}
              myEscrow={data?.myEscrow ?? null}
              hostEscrow={data?.hostEscrow ?? null}
              acceptedOffers={data?.acceptedOffers ?? []}
              guestEscrows={data?.guestEscrows ?? []}
              guestProfiles={data?.guestSlotProfiles ?? []}
              onError={showAgreementAlert}
              onFunded={invalidateAgreement}
            />
          ) : null}

          {showEscrowStateCard ? (
            <AgreementEscrowStateCard
              variant={isPlanConfirmed ? 'confirmed' : 'waiting'}
              plan={plan}
              planId={planId}
              isHost={!!isHost}
              viewerEscrow={viewerEscrow}
              acceptedOffers={data?.acceptedOffers}
              guestEscrows={data?.guestEscrows}
              guestProfiles={data?.guestSlotProfiles}
              onOpenChat={() => void onGoToPlanChat()}
            />
          ) : null}

          {meetupSoon ? (
            <MeetupFundingReminderBanner
              meetupIso={meetupIso}
              role={paymentPreview?.userIsPayer && (needsConfirm || awaitingPay) ? 'payer' : 'host_waiting'}
            />
          ) : null}

          {isHighValue && showPaymentFlow && escrowCents != null ? (
            <HighValueEscrowNoticeCard
              amountCents={escrowCents}
              currency={plan.currency ?? 'NGN'}
              escrowPattern={plan.escrow_pattern}
              userTier={dbUser?.subscription_tier}
              userKycTier={dbUser?.kyc_tier}
              counterpartyKycTier={data?.counterpartyKycTier}
            />
          ) : null}

          {plan.is_group_plan && !isGroupSplit ? (
            <GroupEscrowStatusCard
              planId={planId}
              offerId={offer.id}
              isGroupPlan={!!plan.is_group_plan}
              isHost={!!isHost}
            />
          ) : null}

          {!isGroupSplit && plan.is_paid && user?.id && showPaymentFlow && screenContent.showPaymentButton ? (
            <PlanEscrowPaymentCard plan={plan} offer={offer} currentUserId={user.id} />
          ) : null}

          {paymentPreview && paymentPreviewVariant && !isGroupSplit && showPaymentFlow ? (
            <AgreementPaymentPreviewCard
              preview={paymentPreview}
              variant={paymentPreviewVariant}
              grossCents={userPayGrossCents}
              isGroupSplit={isGroupSplit}
            />
          ) : null}

          <CancellationSummaryCard
            planType={plan?.is_group_plan ? 'group' : plan?.is_mood_plan ? 'mood' : 'standard'}
            escrowPattern={plan?.escrow_pattern ?? 'A'}
          />

          {mutualToast ? (
            <p className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[14px] font-semibold text-[#059669]">
              {mutualToast}
            </p>
          ) : null}

          {showMutualCancel ? (
            <div className="flex flex-row gap-3 pt-2">
        <button
          type="button"
                disabled={busy}
                onClick={() => setMutualCancelOpen(true)}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full linkup-gradient-primary px-3 text-center text-[13px] font-extrabold leading-tight text-white transition hover:opacity-95 disabled:opacity-50 sm:px-4 sm:text-[14px]"
              >
                Suggest mutual cancellation
        </button>
        <button
          type="button"
                disabled={busy}
                onClick={() => (isGuest ? openGuestCancelFlow() : openHostCancelFlow())}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-primary/25 bg-white px-3 text-center text-[13px] font-extrabold leading-tight text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-50 sm:px-4 sm:text-[14px]"
              >
                Cancel this plan
              </button>
            </div>
          ) : null}

          {showSingleGroupCancel ? (
            <div className="pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => (isGuest ? openGuestCancelFlow() : openHostCancelFlow())}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full border border-primary/25 bg-white px-4 text-center text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-50"
              >
                {isHost ? 'Cancel group plan' : 'Cancel this plan'}
        </button>
              {isHost ? (
                <p className="mt-2 text-center text-[12px] font-semibold leading-relaxed text-muted">
                  Group plans use host cancellation with timing-based refunds and guest compensation.
                  Mutual cancellation applies to one-to-one plans only.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
        )}
      </div>

      <AgreementPageActionsBar
        primaryLabel={barPrimaryLabel}
        onPrimary={barOnPrimary}
        primaryDisabled={barPrimaryDisabled}
        busy={busy}
        onMessage={() => void onMessageCounterpart()}
        messageLabel={`Message ${counterpartMessageName}`}
      />
    </>
  );
}

function AgreementBottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl border border-border bg-white p-5 shadow-xl sm:rounded-3xl"
        role="dialog"
        aria-labelledby="agreement-sheet-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 id="agreement-sheet-title" className="font-display text-xl font-extrabold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-[#F5F6FA]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
