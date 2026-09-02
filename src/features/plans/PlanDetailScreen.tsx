'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { ActionButtonsSkeleton } from '@/components/plans/ActionButtonsSkeleton';
import { PlanOffersListSkeleton } from '@/components/plans/PlanOffersListSkeleton';
import { InviteGuestsModal } from '@/components/plans/InviteGuestsModal';
import { PlanShareModal } from '@/components/plans/PlanShareModal';
import { GuestYourJoinRequestCard } from '@/components/plans/joinRequests/GuestYourJoinRequestCard';
import { PlanGroupGuestsPanel } from '@/components/plans/PlanGroupGuestsPanel';
import { GroupMeetupCompletionSection } from '@/components/plans/group/GroupMeetupCompletionSection';
import { GroupPlanMemberCountBadge } from '@/components/plans/group/GroupPlanMemberCountBadge';
import { GroupPlanOptOutSection } from '@/components/plans/group/GroupPlanOptOutSection';
import { GroupHostCancellationModal } from '@/components/plans/GroupHostCancellationModal';
import { GroupPlanPolicyGate } from '@/components/plans/GroupPlanPolicyGate';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { PlanInterestedStrip } from '@/components/plans/PlanInterestedStrip';
import { TierBadge } from '@/components/subscription/TierBadge';
import { BoostPill } from '@/components/plans/BoostPill';
import { PlanBoostControls } from '@/components/plans/PlanBoostControls';
import { OfferStatusBadge } from '@/components/plans/OfferStatusBadge';
import { PlanCardHero } from '@/components/plans/PlanCardHero';
import { PlanningTogetherHostCard } from '@/components/plans/PlanningTogetherHostCard';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { PlanLocationMap } from '@/features/plans/PlanLocationMap';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import {
  formatOfferAmount,
  formatProposalSnippet,
  joinRequestStatusChip,
  ACCEPTED_GUEST_AGREEMENT_LABEL,
  resolvePlanStatusChip,
  planningPartnerContext,
} from '@/features/plans/planDetailUtils';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { resolvePlanAgreementHref } from '@/lib/plans/planAgreementRoute';
import { downloadPlanCalendarIcs, planCanAddToCalendar } from '@/lib/plans/addPlanToCalendar';
import { isPlanDetailActionReady } from '@/lib/plans/planDetailActionReady';
import { insertPlanCompletionAck } from '@/lib/plans/planCompletionAck';
import { usePlanViewerContext, type PlanViewerContext } from '@/lib/plans/usePlanViewerContext';
import { planNegotiateHref } from '@/lib/plans/negotiateRoute';
import { usePlanOffersRealtime } from '@/hooks/useOffersRealtime';
import { useGroupPlanDetailRealtime } from '@/hooks/useGroupPlanDetailRealtime';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { findGroupChatIdForPlan } from '@/lib/messaging/groupChatLookup';
import { groupChatErrorDialog, openOrCreateGroupChat } from '@/lib/messaging/openOrCreateGroupChat';
import { openPlanMeetupChatPath } from '@/lib/messaging/openPlanMeetupChat';
import { planDistanceFromViewer } from '@/lib/discovery/feedFilters';
import { offerLiveAmount } from '@/lib/plans/negotiationState';
import { isOfferExpired } from '@/lib/plans/offerRules';
import { resolveDiscoverViewerCoords } from '@/lib/discovery/viewerLocation';
import { planMeetupCoords } from '@/lib/plans/planMeetupCoords';
import { daysUntilIso, isPlanActiveWindowExpiringSoon } from '@/lib/plans/planActiveWindow';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { isPlanListingExpired, isPlanMoodWindowClosed, planListingExpiresAt } from '@/lib/plans/planExpiry';
import { resolveGroupPlanDisplayStatus } from '@/lib/plans/groupFundedMemberCount';
import { resolvePlanMeetupInactive } from '@/lib/plans/planMeetupInactive';
import { planExpiredDialogContent } from '@/lib/plans/planExpiredDialog';
import { planShareCity, planSharePriceLabel } from '@/lib/plans/planSharePreview';
import { formatPlanAppFee, formatPlanCreated, formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { countPendingInvitations, getPlanAvailableSlots } from '@/lib/plans/planInvitations';
import { usePermission } from '@/hooks/usePermission';
import { extendMoodPlan } from '@/lib/plans/moodPlanCooldown';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import {
  type PlanDetailFrom,
  resolvePlanDetailBack,
} from '@/lib/plans/planDetailNavigation';
import type { BoostQuotaMeta } from '@/lib/subscription/boostQuota';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { fetchPlanDetailBundle, type PlanDetailBundle } from '@/services/planDetail.service';
import { useTogglePlanSaved } from '@/features/saved/useTogglePlanSaved';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoDocumentTextOutline,
  IoLocationOutline,
  IoPricetagOutline,
  IoShieldCheckmarkOutline,
  IoLockClosed,
  IoPeople,
  IoPersonAddOutline,
  IoShareOutline,
  IoTimeOutline,
} from 'react-icons/io5';

/** Auto-fit grid: buttons share a row until min cell width forces the next row. */
const planActionGrid =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-3';
const actionPrimary =
  'flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm disabled:opacity-50';
const actionSecondary =
  'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-white px-5 py-2.5 text-[14px] font-extrabold text-primary hover:bg-[#EDE8FF]/50 disabled:opacity-50';
/** Compact pills — matches PlanGroupGuestsPanel escrow button sizing. */
const actionCompactPrimary =
  'inline-flex h-9 w-[8.5rem] items-center justify-center gap-1 rounded-full linkup-gradient-primary px-2.5 text-[12px] font-extrabold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50';
const actionCompactSecondary =
  'inline-flex h-9 w-[8.5rem] items-center justify-center gap-1 rounded-full border border-primary/25 bg-white px-2.5 text-[12px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-50';

type Props = {
  planId: string;
  currentUserId: string | null;
  initialBundle?: PlanDetailBundle;
  planDetailFrom?: PlanDetailFrom | null;
};

export function PlanDetailScreen({
  planId,
  currentUserId,
  initialBundle,
  planDetailFrom = null,
}: Props) {
  const router = useRouter();
  const planDetailBack = resolvePlanDetailBack(planDetailFrom);
  const user = useAuthStore((s) => s.user);
  /** Server-resolved id is correct on first paint before the auth store hydrates. */
  const viewerUserId = user?.id ?? currentUserId ?? undefined;
  const [gateOpen, setGateOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [groupChatBusy, setGroupChatBusy] = useState(false);
  const [hostCancelOpen, setHostCancelOpen] = useState(false);
  const [groupChatConvId, setGroupChatConvId] = useState<string | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendMsg, setExtendMsg] = useState<string | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
    buttonLabel?: string;
    onDismiss?: () => void;
  } | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [availableSlots, setAvailableSlots] = useState(initialBundle?.availableSlots ?? 0);
  const [pendingInvitationCount, setPendingInvitationCount] = useState(
    initialBundle?.pendingInvitationCount ?? 0
  );
  const toggleSaved = useTogglePlanSaved(viewerUserId);
  const {
    allowed: canBoost24,
    metadata: boost24Meta,
    refresh: refreshBoost24,
  } = usePermission('boost.24hr', { checkQuota: true });
  const {
    allowed: canBoost72,
    metadata: boost72Meta,
    refresh: refreshBoost72,
  } = usePermission('boost.72hr', { checkQuota: true });
  const { allowed: canExtendMood } = usePermission('mood_plan.extend');
  const { allowed: travelModeAllowed } = usePermission('discover.travel_mode');

  const profileQuery = useQuery({
    queryKey: ['profile-bundle', viewerUserId],
    queryFn: async () => {
      if (!viewerUserId) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, viewerUserId);
      if (bundle.error) throw new Error(bundle.error);
      return bundle;
    },
    enabled: !!viewerUserId,
  });

  const detailQuery = useQuery({
    queryKey: ['plan-detail', planId, viewerUserId ?? ''],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchPlanDetailBundle(client, planId, viewerUserId ?? null);
      if (error) throw new Error(error);
      if (!data) throw new Error('Plan not found');
      return data;
    },
    initialData: initialBundle,
    enabled: !!viewerUserId,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const p = query.state.data?.plan;
      if (!p || isPlanListingExpired(p)) return false;
      const expiresAt = planListingExpiresAt(p);
      if (!expiresAt) return false;
      const msUntil = expiresAt.getTime() - Date.now();
      if (msUntil <= 0) return 5_000;
      if (msUntil <= 5 * 60_000) return 30_000;
      return false;
    },
  });

  const groupEscrowsQuery = useQuery({
    queryKey: ['plan-group-escrows', planId],
    enabled: !!detailQuery.data?.plan?.is_group_plan,
    queryFn: async () => {
      const client = createClient();
      const { data } = await client
        .from('escrow_transactions')
        .select(
          'id, guest_id, host_id, payer_id, status, escrow_pattern, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents, amount_cents'
        )
        .eq('plan_id', planId);
      return data ?? [];
    },
    staleTime: 0,
  });

  const bundle = detailQuery.data;
  const plan = bundle?.plan;
  const displayPlanStatus = useMemo(() => {
    if (!plan) return null;
    if (!plan.is_group_plan || groupEscrowsQuery.isLoading) {
      return plan.status;
    }
    return resolveGroupPlanDisplayStatus(plan, groupEscrowsQuery.data ?? []);
  }, [groupEscrowsQuery.data, groupEscrowsQuery.isLoading, plan]);
  usePlanOffersRealtime(planId);
  useGroupPlanDetailRealtime(planId, !!plan?.is_group_plan);
  const dbUser = profileQuery.data?.dbUser ?? null;
  const runGated = useGatedAction();

  const partnerCtx = useMemo(() => {
    if (!plan || !bundle) return null;
    return planningPartnerContext(plan, viewerUserId, bundle.offers, bundle.profilesById);
  }, [plan, viewerUserId, bundle]);

  const isCreator = !!viewerUserId && plan?.creator_id === viewerUserId;
  const isGroupPlan = !!plan?.is_group_plan;
  const moodClosed = plan ? isPlanMoodWindowClosed(plan) : false;
  const planListingExpired = plan ? isPlanListingExpired(plan) : false;
  const meetupInactiveState = plan ? resolvePlanMeetupInactive(plan, planListingExpired) : null;
  const meetupInactive = meetupInactiveState?.inactive ?? false;
  const showInvite =
    isCreator &&
    isGroupPlan &&
    !meetupInactive &&
    (availableSlots > 0 || pendingInvitationCount > 0);
  const boosted = plan ? isPlanBoostActive(plan.boosted_until) : false;

  const acceptedGuestOffers = useMemo(
    () =>
      bundle?.activeAcceptedRoster?.length
        ? bundle.activeAcceptedRoster
        : (bundle?.offers ?? []).filter((o) => o.status === 'accepted'),
    [bundle?.activeAcceptedRoster, bundle?.offers]
  );
  const approvedJoinRequests = useMemo(
    () => (bundle?.joinRequests ?? []).filter((r) => r.status === 'approved'),
    [bundle?.joinRequests]
  );

  const ctx = usePlanViewerContext(plan ?? null, viewerUserId, bundle?.offers ?? [], {
    listingExpired: planListingExpired,
    completionSelfAcked: bundle?.completionSelfAcked ?? false,
    myJoinRequest: bundle?.myJoinRequest ?? null,
    myInvitation: bundle?.myInvitation ?? null,
    activeAcceptedRoster: bundle?.activeAcceptedRoster ?? [],
    myGuestEscrow: bundle?.myGuestEscrow ?? null,
    myHostEscrow: bundle?.myHostEscrow ?? null,
    groupGuestEscrows: groupEscrowsQuery.data ?? [],
    hostGroupContribution: bundle?.hostGroupContribution ?? null,
    approvedJoinRequestCount: bundle?.approvedJoinRequestCount ?? approvedJoinRequests.length,
    availableSlots: bundle?.availableSlots,
  });
  const actionContextReady = isPlanDetailActionReady(bundle);
  const [actionButtonsReady, setActionButtonsReady] = useState(() =>
    initialBundle ? isPlanDetailActionReady(initialBundle) : false
  );

  useEffect(() => {
    setActionButtonsReady(false);
  }, [planId]);

  useEffect(() => {
    if (actionContextReady) setActionButtonsReady(true);
  }, [actionContextReady]);

  const showHostGuestAgreements =
    isCreator &&
    (ctx?.showGroupGuestAgreements ||
      (plan?.is_negotiable === false && approvedJoinRequests.length > 0));
  const isAcceptedGuest = !!ctx?.isConfirmedGuest;
  const guestsPanelRefreshKey = useMemo(
    () =>
      [
        plan?.accepted_guest_count,
        plan?.max_guests,
        plan?.updated_at,
        plan?.status,
        groupEscrowsQuery.dataUpdatedAt,
        ...acceptedGuestOffers.map(
          (o) => `${o.id}:${o.status}:${o.current_amount_cents ?? o.amount_cents}:${o.bidder_id}`
        ),
        detailQuery.dataUpdatedAt,
      ].join('|'),
    [
      acceptedGuestOffers,
      detailQuery.dataUpdatedAt,
      groupEscrowsQuery.dataUpdatedAt,
      plan?.accepted_guest_count,
      plan?.max_guests,
      plan?.status,
      plan?.updated_at,
    ]
  );

  useEffect(() => {
    setAvailableSlots(bundle?.availableSlots ?? 0);
    setPendingInvitationCount(bundle?.pendingInvitationCount ?? 0);
  }, [bundle?.availableSlots, bundle?.pendingInvitationCount]);

  function refreshInvitationSlots() {
    if (!plan?.id || !isCreator || !isGroupPlan) return;
    void getPlanAvailableSlots(plan.id).then(setAvailableSlots);
    void countPendingInvitations(plan.id).then(setPendingInvitationCount);
  }

  const refreshGroupPlanState = useCallback(() => {
    void detailQuery.refetch();
    void groupEscrowsQuery.refetch();
    refreshInvitationSlots();
  }, [detailQuery, groupEscrowsQuery, plan?.id, isCreator, isGroupPlan]);

  function handleAddToCalendar() {
    if (!plan) return;
    if (!planCanAddToCalendar(plan)) {
      setStatusDialog({
        title: 'No date yet',
        message: 'Once this plan has a scheduled time, you can add it to your calendar.',
        variant: 'info',
      });
      return;
    }
    setCalendarBusy(true);
    const result = downloadPlanCalendarIcs(plan, planId);
    setCalendarBusy(false);
    if (result.ok) {
      setStatusDialog({
        title: 'Calendar',
        message: 'Your calendar file was downloaded. Open it to add the event.',
        variant: 'success',
      });
    } else {
      setStatusDialog({ title: 'Calendar', message: result.message, variant: 'error' });
    }
  }

  async function handleConfirmAttendance() {
    if (!viewerUserId || !plan) return;
    setAttendanceBusy(true);
    const client = createClient();
    const { error } = await insertPlanCompletionAck(client, plan.id, viewerUserId);
    setAttendanceBusy(false);
    if (error) {
      setStatusDialog({ title: 'Could not save', message: error, variant: 'error' });
      return;
    }
    void detailQuery.refetch();
    setStatusDialog({
      title: 'Thanks',
      message:
        'When both people confirm, contact sharing outside LinkUp is allowed for this plan.',
      variant: 'success',
    });
  }

  function goViewOffer() {
    if (!ctx?.myOffer) return;
    router.push(planNegotiateHref(planId, { offerId: ctx.myOffer.id }));
  }

  function showPlanExpired(action: 'offer' | 'join' | 'share' | 'invite') {
    const dialog = planExpiredDialogContent(action);
    setStatusDialog({ ...dialog, variant: 'info' });
  }

  function showMeetupInactiveModal(): boolean {
    if (!plan) return false;
    const inactive = resolvePlanMeetupInactive(plan, planListingExpired);
    if (!inactive.inactive) return false;
    setStatusDialog({
      title: inactive.title,
      message: inactive.message,
      variant: 'info',
      buttonLabel: 'Got it',
    });
    return true;
  }

  function handleHostGuestsHeaderAction() {
    if (showMeetupInactiveModal()) return;
    if (ctx?.showHostPayShare) {
      if (ctx.hostPayShareEscrowId) {
        router.push(`/escrow/${ctx.hostPayShareEscrowId}?planId=${planId}&source=plan`);
        return;
      }
      router.push(`/plan/${planId}/agreement`);
      return;
    }
    goAgreement();
  }

  function goNegotiate() {
    if (planListingExpired) {
      showPlanExpired('offer');
      return;
    }
    if (!isCreator && requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (ctx?.showViewOffer) {
      goViewOffer();
      return;
    }
    if (
      ctx?.showViewAgreement &&
      plan &&
      (ctx.isMatchedGuest || !ctx.showManageOffers)
    ) {
      goAgreement();
      return;
    }
    router.push(`/plan/${planId}/negotiate`);
  }

  function goAgreement(offerId?: string, joinRequestId?: string) {
    if (!plan) return;
    if (showMeetupInactiveModal()) return;

    if (plan.is_negotiable === false) {
      if (isCreator && !joinRequestId) {
        router.push(`/plan/${planId}/agreement`);
        return;
      }
      const resolvedJoinRequestId =
        joinRequestId ?? bundle?.myJoinRequest?.id ?? null;
      router.push(
        resolvePlanAgreementHref(plan, {
          joinRequestId: resolvedJoinRequestId,
          userId: viewerUserId,
        })
      );
      return;
    }

    const resolvedOfferId =
      offerId ??
      ctx?.userAcceptedOffer?.id ??
      (ctx?.myOffer?.status === 'accepted' ? ctx.myOffer.id : undefined) ??
      bundle?.offers.find((o) => o.bidder_id === viewerUserId && o.status === 'accepted')?.id ??
      plan.accepted_offer_id ??
      bundle?.offers.find((o) => o.status === 'accepted')?.id;
    router.push(
      resolvePlanAgreementHref(plan, {
        offerId: resolvedOfferId,
        userId: viewerUserId,
        offers: bundle?.offers,
      })
    );
  }

  async function openHostMessage() {
    if (!viewerUserId || !plan) return;
    if (plan.is_group_plan) {
      await handleOpenGroupChat();
      return;
    }
    await openCounterpartyChat();
  }

  function toggleSave() {
    if (!viewerUserId || !plan) return;
    void runGated('plans.bookmark', () => {
    const next = !bundle?.saved;
      toggleSaved.mutate(
        { planId: plan.id, userId: viewerUserId, saved: next, plan },
        {
          onError: (err) => {
            setStatusDialog({
              title: 'Could not save',
              message: err instanceof Error ? err.message : 'Could not update save',
              variant: 'error',
            });
          },
        }
      );
    });
  }

  async function handleExtendMood() {
    if (!viewerUserId || !plan) return;
    setExtendBusy(true);
    setExtendMsg(null);
    const result = await extendMoodPlan(plan.id, viewerUserId);
    setExtendBusy(false);
    if (result.extended && result.new_expires_at) {
      setExtendMsg(`Plan extended until ${new Date(result.new_expires_at).toLocaleString('en-GB')}`);
      void detailQuery.refetch();
    } else {
      setExtendMsg(result.reason ?? 'Could not extend plan');
    }
  }

  useEffect(() => {
    if (!plan?.is_group_plan || !plan.id) return;
    const client = createClient();
    void findGroupChatIdForPlan(client, plan.id).then((id) => {
      if (id) setGroupChatConvId(id);
    });
  }, [plan?.id, plan?.is_group_plan]);

  async function handleOpenGroupChat() {
    if (!viewerUserId || !plan || groupChatBusy) return;
    setGroupChatBusy(true);
    try {
      if (groupChatConvId) {
        router.push(`/chat/group/${groupChatConvId}`);
        return;
      }
      const client = createClient();
      const convId = await openOrCreateGroupChat(client, {
        plan,
        userId: viewerUserId,
        offers: bundle?.offers,
        joinRequests: bundle?.joinRequests,
      });
      setGroupChatConvId(convId);
      router.push(`/chat/group/${convId}`);
    } catch (e) {
      const dialog = groupChatErrorDialog(e);
      setStatusDialog({
        title: dialog.title,
        message: dialog.message,
        variant: dialog.variant,
        buttonLabel: dialog.buttonLabel,
        onDismiss: dialog.retry ? () => void handleOpenGroupChat() : undefined,
      });
    } finally {
      setGroupChatBusy(false);
    }
  }

  async function openCounterpartyChat() {
    if (!viewerUserId || !plan) return;
    setChatBusy(true);
    try {
      const client = createClient();
      const path = await openPlanMeetupChatPath(client, {
        plan,
        userId: viewerUserId,
        isCreator,
        offers: bundle?.offers ?? [],
        joinRequests: bundle?.joinRequests,
      });
      router.push(path);
    } catch (e) {
      const dialog = plan.is_group_plan
        ? groupChatErrorDialog(e)
        : {
            title: 'Unable to open chat',
            message:
              e instanceof Error && e.message
                ? e.message
                : 'We could not open this chat right now. Please try again.',
            variant: 'error' as const,
            buttonLabel: 'Got it',
            retry: false,
          };
      setStatusDialog({
        title: dialog.title,
        message: dialog.message,
        variant: dialog.variant,
        buttonLabel: dialog.buttonLabel,
        onDismiss: dialog.retry ? () => void openCounterpartyChat() : undefined,
      });
    } finally {
      setChatBusy(false);
    }
  }

  async function openDirectGuestChat(guestUserId: string) {
    if (!viewerUserId) return;
    setChatBusy(true);
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, viewerUserId, guestUserId);
      router.push(path);
    } catch {
      setStatusDialog({
        title: 'Unable to open chat',
        message: 'We could not open this chat right now. Please try again.',
        variant: 'error',
        buttonLabel: 'Got it',
      });
    } finally {
      setChatBusy(false);
    }
  }

  if ((detailQuery.isLoading || detailQuery.isFetching) && !plan) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#EDE8FF]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#EDE8FF]/60" />
      </div>
    );
  }

  if (detailQuery.isError && !plan) {
    return (
      <AppEmptyState
        emoji="⚠️"
        title="Could not load this plan"
        description={
          detailQuery.error instanceof Error
            ? detailQuery.error.message
            : 'Check your connection and try again.'
        }
        action={{
          label: 'Reload',
          onClick: () => {
            void detailQuery.refetch();
          },
        }}
        secondaryAction={{
          label: planDetailBack.label,
          href: planDetailBack.href,
          variant: 'secondary',
        }}
      />
    );
  }

  if (!plan) {
    return (
      <div className="linkup-card px-6 py-12 text-center">
        <p className="font-extrabold text-foreground">Plan not found</p>
        <p className="mt-2 text-[14px] font-semibold text-muted">This plan may have been removed.</p>
        <Link href={planDetailBack.href} className="mt-4 inline-block font-extrabold text-primary underline">
          {planDetailBack.label}
        </Link>
      </div>
    );
  }

  const when = formatPlanWhen(plan);
  const created = formatPlanCreated(plan);
  const price = formatPlanPrice(plan) ?? 'Open to offers';
  const appFee = formatPlanAppFee(plan);
  const viewerCoords = resolveDiscoverViewerCoords(
    profileQuery.data?.profile ?? null,
    travelModeAllowed,
    null
  );
  let distanceAwayKm: number | null = null;
  if (viewerCoords.lat != null && viewerCoords.lng != null && planMeetupCoords(plan)) {
    const d = planDistanceFromViewer(plan, viewerCoords.lat, viewerCoords.lng);
    distanceAwayKm = Number.isFinite(d) ? Math.round(d) : null;
  }
  const meetupPin = planMeetupCoords(plan);

  return (
    <GroupPlanPolicyGate active={isGroupPlan}>
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
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
      {plan && showInvite ? (
        <InviteGuestsModal
          planId={planId}
          planDetails={{
            name: plan.title?.trim() || 'Meetup',
            hostName:
              profileQuery.data?.profile?.display_name?.trim() ||
              bundle?.profilesById[plan.creator_id]?.display_name?.trim() ||
              'Host',
            meetType: plan.meet_types?.name,
            planDate: formatPlanWhen(plan),
            planLocation: plan.location_label ?? undefined,
            shareAmountCents: plan.current_suggested_share_cents ?? undefined,
          }}
          availableSlots={availableSlots}
          planListingExpired={planListingExpired}
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          onSlotsChanged={refreshInvitationSlots}
          onPlanExpired={() => showPlanExpired('invite')}
        />
      ) : null}

      {plan ? (
        <PlanShareModal
          planId={planId}
          planTitle={plan.title}
          meetTypeName={plan.meet_types?.name ?? 'Meetup'}
          city={planShareCity(plan.location_label)}
          meetDateLabel={
            plan.scheduled_at
              ? new Date(plan.scheduled_at).toLocaleDateString('en-NG', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
              : null
          }
          priceLabel={planSharePriceLabel(plan)}
          hostDisplayName={bundle?.profilesById[plan.creator_id]?.display_name ?? null}
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          currentUserId={viewerUserId ?? null}
        />
      ) : null}

      <PlanFlowHeader
        kicker="Meetup details"
        title={plan.title}
        subtitle={plan.location_label ?? undefined}
        backHref={planDetailBack.href}
        backLabel={planDetailBack.label}
        right={
          <button
            type="button"
            onClick={() => {
              if (planListingExpired) {
                showPlanExpired('share');
                return;
              }
              setShareModalOpen(true);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 text-foreground shadow-sm transition hover:bg-[#EDE8FF]/60"
            aria-label="Share this plan"
          >
            <IoShareOutline size={22} />
          </button>
        }
      />

      {(plan.is_expired || plan.status === 'expired') && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-slate-600">
            This plan has expired. The scheduled time has passed without confirmation.
            Escrow funds have been refunded per the cancellation policy.
          </p>
        </div>
      )}

      {planListingExpired && !meetupInactive ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-700">
          This plan has ended. You can still view details, but new offers, join requests, invitations,
          and sharing are closed.
        </div>
      ) : null}

      {meetupInactive && meetupInactiveState?.inactive ? (
        <div className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900">
          <p className="font-extrabold">{meetupInactiveState.title}</p>
          <p className="mt-1 font-semibold leading-relaxed">{meetupInactiveState.message}</p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-[0_8px_28px_rgba(42,31,85,0.08)]">
        <PlanCardHero plan={plan} className="h-52 md:h-60" />
        <div className="space-y-4 p-5 md:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold text-foreground md:text-2xl">{plan.title}</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {plan.is_group_plan ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#5E52FF] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
                    <IoPeople size={12} />
                    Group
                  </span>
                ) : null}
                {plan.is_mood_plan ? (
                  <span className="inline-flex items-center rounded-full bg-[#FF4A72]/90 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
                    Mood
                  </span>
                ) : null}
              {boosted ? <BoostPill /> : null}
                {(() => {
                  const chip = plan
                    ? resolvePlanStatusChip(plan, displayPlanStatus ?? plan.status)
                    : { label: '', className: 'bg-border text-muted' };
                  return (
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-extrabold capitalize',
                        chip.className
                      )}
                    >
                      {chip.label}
              </span>
                  );
                })()}
            </div>
            </div>

            {plan.is_group_plan ? (
              <GroupPlanMemberCountBadge
                planId={plan.id}
                hostUserId={plan.creator_id}
                hostEscrowId={plan.host_escrow_id ?? null}
                totalCapacity={(plan.max_guests ?? 0) + 1}
                minimumCount={plan.minimum_member_count ?? 5}
                refreshKey={guestsPanelRefreshKey}
              />
            ) : null}
          </div>
          {plan.description ? (
            <p className="text-[14px] font-semibold leading-relaxed text-muted">{plan.description}</p>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2">
            <MetaItem icon={IoCalendarOutline} label="When" value={when} />
            <MetaItem icon={IoLocationOutline} label="Where" value={plan.location_label ?? 'TBD'} />
            <MetaItem icon={IoTimeOutline} label="Created" value={created} />
            <MetaItem icon={IoPricetagOutline} label="Price" value={price} />
            {appFee ? (
              <MetaItem
                icon={IoShieldCheckmarkOutline}
                label="App fee"
                value={appFee}
                iconTone="fee"
              />
            ) : null}
          </dl>
          {distanceAwayKm != null ? (
            <p className="text-[13px] font-semibold text-muted">{distanceAwayKm} km away</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-[#EDE8FF]/40 to-[#FFF0F5]/50 p-5">
        <h3 className="font-display text-lg font-extrabold text-foreground">Planning together</h3>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          {partnerCtx?.mode === 'hosting'
            ? 'When you accept an offer, your match appears here.'
            : 'The person behind this meetup.'}
        </p>
        {partnerCtx?.mode === 'hosting' ? (
          <p className="mt-4 rounded-xl border border-dashed border-primary/25 bg-white/70 px-4 py-3 text-[13px] font-semibold text-muted">
            You&apos;re hosting. Interested guests send offers, then you can match and chat.
          </p>
        ) : partnerCtx?.mode === 'person' ? (
          <PlanningTogetherHostCard
            profile={partnerCtx.profile}
            roleLabel={partnerCtx.roleLabel}
            userId={partnerCtx.otherUserId}
          />
        ) : null}
      </section>

      {isCreator &&
      plan.is_mood_plan &&
      !moodClosed &&
      (plan.status === 'negotiating' || plan.status === 'agreed') ? (
        <div className="rounded-2xl border border-border bg-white p-4">
          {canExtendMood ? (
            <button
              type="button"
              onClick={() => void handleExtendMood()}
              disabled={
                extendBusy ||
                ((plan.extension_count ?? 0) >= 1 && plan.host_tier !== 'PLATINUM')
              }
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/25 bg-white text-[14px] font-extrabold text-primary disabled:opacity-50"
            >
              <IoTimeOutline size={18} />
              {extendBusy
                ? 'Extending…'
                : (plan.extension_count ?? 0) >= 1 && plan.host_tier !== 'PLATINUM'
                  ? 'Extension used'
                  : 'Extend plan'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void runGated('mood_plan.extend', () => {})}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-border text-[14px] font-extrabold text-muted opacity-80"
            >
              <IoLockClosed size={16} />
              Extend plan
              <TierBadge tier="GOLD" size="sm" />
            </button>
          )}
          {extendMsg ? (
            <p className="mt-2 text-center text-[12px] font-semibold text-muted">{extendMsg}</p>
                ) : null}
              </div>
              ) : null}

      <PlanGroupGuestsPanel
        plan={plan}
        hostUserId={plan.creator_id}
        currentUserId={viewerUserId}
        seedAcceptedOffers={acceptedGuestOffers}
        offersReady={!!bundle}
        refreshKey={guestsPanelRefreshKey}
        guestsHeaderAction={
          isCreator && plan.is_group_plan
            ? ctx?.showHostPayShare
              ? {
                  show: true,
                  kind: 'pay_share' as const,
                  amountLabel: ctx.hostPayShareAmountLabel ?? null,
                  onClick: handleHostGuestsHeaderAction,
                }
              : !meetupInactive && ctx?.showViewAgreement
                ? {
                    show: true,
                    kind: 'confirm_plan' as const,
                    amountLabel: null,
                    onClick: handleHostGuestsHeaderAction,
                  }
                : undefined
            : undefined
        }
        onGuestRemoved={refreshGroupPlanState}
      />

      {isAcceptedGuest && plan.is_group_plan ? (
        <GroupPlanOptOutSection
          planId={plan.id}
          scheduledAt={plan.agreed_scheduled_at ?? plan.scheduled_at}
          isGuest={isAcceptedGuest}
          onOptedOut={refreshGroupPlanState}
        />
      ) : null}

      {isCreator && plan.is_group_plan && plan.completion_status === 'awaiting_confirm' ? (
        <GroupMeetupCompletionSection
          planId={plan.id}
          onConfirmed={() => void detailQuery.refetch()}
        />
      ) : null}

      {isCreator && viewerUserId ? (
        <PlanInterestedStrip planId={plan.id} hostUserId={plan.creator_id} currentUserId={viewerUserId} />
      ) : null}

      {isCreator && viewerUserId && plan.active_expires_at && !plan.is_mood_plan ? (
        <div
          className={cn(
            'flex items-center gap-1.5 text-[12px] font-semibold',
            isPlanActiveWindowExpiringSoon(plan.active_expires_at)
              ? 'text-amber-700'
              : 'text-muted'
          )}
        >
          <IoTimeOutline size={14} className="shrink-0" aria-hidden />
          <span>
            {isPlanActiveWindowExpiringSoon(plan.active_expires_at)
              ? `Listing expires in ${daysUntilIso(plan.active_expires_at)} days`
              : `Listed until ${new Date(plan.active_expires_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`}
          </span>
          </div>
        ) : null}

      {!actionButtonsReady ? (
        <ActionButtonsSkeleton />
      ) : (
        <div className="space-y-3">
      {isCreator && viewerUserId ? (
        <div className={planActionGrid}>
          {ctx?.showBoost ? (
          <PlanBoostControls
            planId={plan.id}
            creatorId={plan.creator_id}
            dbUser={dbUser}
            boosted={boosted}
            boostedUntil={plan.boosted_until}
        moodClosed={moodClosed}
            canBoost24={canBoost24}
            canBoost72={canBoost72}
            boost24Meta={boost24Meta as BoostQuotaMeta | undefined}
            boost72Meta={boost72Meta as BoostQuotaMeta | undefined}
            planVisibility={plan.visibility}
            boostRadiusKm={plan.boost_radius_km}
            onBoosted={() => void detailQuery.refetch()}
            onRefreshPermissions={() => {
              void refreshBoost24();
              void refreshBoost72();
            }}
          />
          ) : null}
          {showInvite ? (
            <button
              type="button"
              className={actionSecondary}
              onClick={() => {
                if (planListingExpired) {
                  showPlanExpired('invite');
                  return;
                }
                setInviteModalOpen(true);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <IoPersonAddOutline size={18} />
                Invite
              </span>
            </button>
          ) : null}
        </div>
      ) : ctx && !isCreator ? (
        <ActionRail
          ctx={ctx}
          listingExpired={planListingExpired}
        saved={!!bundle?.saved}
          saveBusy={toggleSaved.isPending}
        chatBusy={chatBusy}
          calendarBusy={calendarBusy}
          canCalendar={planCanAddToCalendar(plan)}
        onSave={() => void toggleSave()}
        onNegotiate={goNegotiate}
          onViewOffer={goViewOffer}
          onAgreement={goAgreement}
        onChat={() => void openCounterpartyChat()}
          onCalendar={handleAddToCalendar}
        />
      ) : null}

      {isCreator &&
      !plan.is_group_plan &&
      ctx?.showViewAgreement &&
      !ctx.showHostPayShare &&
      !resolvePlanMeetupInactive(plan, planListingExpired).inactive ? (
        <button type="button" className={actionPrimary} onClick={() => goAgreement()}>
          <span className="inline-flex items-center justify-center gap-2">
            <IoDocumentTextOutline size={18} aria-hidden />
            Confirm plan
          </span>
        </button>
      ) : null}

      {ctx?.showConfirmAttendance ? (
        <button
          type="button"
          disabled={attendanceBusy}
          onClick={() => void handleConfirmAttendance()}
          className="flex w-full min-h-[44px] items-center justify-center rounded-full border border-primary/25 bg-white px-5 py-2.5 text-[14px] font-extrabold text-primary disabled:opacity-50"
        >
          {attendanceBusy ? 'Saving…' : 'Confirm attendance for safety unlock'}
        </button>
      ) : null}

      {showHostGuestAgreements ? (
        <section className="linkup-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-extrabold text-foreground">Accepted guests</h3>
            {plan.is_group_plan ? (
              <div className="flex shrink-0 items-center gap-2">
                {isCreator &&
                !resolvePlanMeetupInactive(plan, planListingExpired).inactive &&
                ['active', 'agreed', 'awaiting_payment', 'negotiating'].includes(plan.status) ? (
                  <button
                    type="button"
                    onClick={() => setHostCancelOpen(true)}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-[#EF4444] px-4 py-2 text-[12px] font-extrabold text-white shadow-sm transition hover:bg-[#DC2626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EF4444] disabled:opacity-50"
                  >
                    Cancel plan
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void openHostMessage()}
                  disabled={groupChatBusy}
                  className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[12px] font-extrabold text-foreground shadow-sm transition hover:bg-[#F8F7FF] disabled:opacity-50"
                >
                  <IoChatbubbleEllipsesOutline size={16} aria-hidden />
                  {groupChatBusy ? 'Opening…' : 'Message group'}
                </button>
              </div>
            ) : null}
          </div>
          <ul className="space-y-2">
            {plan.is_negotiable !== false
              ? (ctx?.acceptedGuests ?? []).map((guest) => {
                  const prof = bundle?.profilesById[guest.userId];
                  const name = prof?.display_name?.trim() || 'Guest';
                  return (
                    <li
                      key={guest.offerId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[#FAFAFF]/80 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <ProfileAvatar profile={prof} displayName={name} size={36} />
                        <span className="min-w-0 truncate font-extrabold text-foreground">{name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className={actionCompactPrimary}
                          onClick={() => goAgreement(guest.offerId)}
                        >
                          <IoDocumentTextOutline size={14} aria-hidden />
                          {ACCEPTED_GUEST_AGREEMENT_LABEL}
                        </button>
                        <button
                          type="button"
                          className={actionCompactSecondary}
                          onClick={() => void openDirectGuestChat(guest.userId)}
                        >
                          <IoChatbubbleEllipsesOutline size={14} aria-hidden />
                          Message
                        </button>
                      </div>
                    </li>
                  );
                })
              : approvedJoinRequests.map((request) => {
                  const prof =
                    request.requester ??
                    bundle?.profilesById[request.requester_id];
                  const name = prof?.display_name?.trim() || 'Guest';
                  return (
                    <li
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[#FAFAFF]/80 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <ProfileAvatar profile={prof} displayName={name} size={36} />
                        <span className="min-w-0 truncate font-extrabold text-foreground">{name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className={actionCompactPrimary}
                          onClick={() => goAgreement(undefined, request.id)}
                        >
                          <IoDocumentTextOutline size={14} aria-hidden />
                          {ACCEPTED_GUEST_AGREEMENT_LABEL}
                        </button>
                        <button
                          type="button"
                          className={actionCompactSecondary}
                          onClick={() => void openDirectGuestChat(request.requester_id)}
                        >
                          <IoChatbubbleEllipsesOutline size={14} aria-hidden />
                          Message
                        </button>
                      </div>
                    </li>
                  );
                })}
          </ul>
        </section>
      ) : null}

      {isCreator && ctx?.showViewAgreement && ctx.showMessage && !ctx.showGroupGuestAgreements ? (
        <div className={planActionGrid}>
          <button type="button" className={actionSecondary} onClick={() => goAgreement()}>
            <span className="inline-flex items-center gap-2">
              <IoDocumentTextOutline size={18} />
              View agreement & pay
            </span>
          </button>
          <button type="button" className={actionPrimary} onClick={() => void openCounterpartyChat()} disabled={chatBusy}>
            <span className="inline-flex items-center gap-2">
              <IoChatbubbleEllipsesOutline size={18} />
              Message
            </span>
          </button>
        </div>
      ) : null}

        </div>
      )}

      {plan.is_negotiable === false && !isCreator ? (
        !actionContextReady || !ctx ? (
          <section className="linkup-card overflow-hidden p-4">
            <PlanOffersListSkeleton />
          </section>
        ) : (
          <GuestYourJoinRequestCard
            plan={plan}
            planId={planId}
            ctx={ctx}
            myJoinRequest={bundle?.myJoinRequest ?? null}
            listingExpired={planListingExpired}
            onJoinSuccess={() => void detailQuery.refetch()}
            onPlanExpired={() => showPlanExpired('join')}
            onPayShare={() => {
              if (ctx.payShareEscrowId) {
                router.push(`/escrow/${ctx.payShareEscrowId}`);
              }
            }}
          />
        )
      ) : (
      <section className="linkup-card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-extrabold text-foreground">
                  {plan.is_negotiable !== false ? 'Recent offers' : 'Recent requests'}
                </h3>
                {plan.is_negotiable !== false && bundle && bundle.offers.length > 0 ? (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                {bundle.offers.length}
              </span>
            ) : null}
                {plan.is_negotiable === false && bundle && bundle.joinRequests.length > 0 ? (
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                    {bundle.joinRequests.length}
                  </span>
                ) : null}
          </div>
          <p className="mt-1 text-[13px] font-semibold text-muted">
                {plan.is_negotiable !== false
                  ? isCreator
              ? 'Everyone who has put forward an offer on this plan.'
                    : 'Latest activity from people interested in this plan.'
                  : 'Guests who asked to join this plan at the listed price.'}
          </p>
        </div>
            {isCreator && plan.is_negotiable !== false && ctx?.showManageOffers ? (
              <button type="button" className={cn(actionPrimary, 'w-auto shrink-0')} onClick={goNegotiate}>
                Manage offers
              </button>
            ) : null}
            {isCreator && plan.is_negotiable === false ? (
              <Link href={`/plan/${planId}/requests`} className={cn(actionPrimary, 'w-auto shrink-0')}>
                <span className="inline-flex items-center gap-2">
                  <IoPeople size={18} />
                  Manage requests
                </span>
              </Link>
            ) : null}
          </div>
        </div>
        {!actionContextReady ? (
          <PlanOffersListSkeleton />
        ) : plan.is_negotiable !== false ? (
          !bundle?.offers.length ? (
          <div className="px-4 py-6">
            <AppEmptyState
              variant="compact"
              emoji="💡"
              title="No offers yet"
              description={
                isCreator
                    ? 'Share your plan. Interested guests send suggestions from Discover or negotiate.'
                    : 'Be the first to say hello. Send an offer with your timing and budget.'
              }
              action={{
                  label: isCreator
                    ? ctx?.showManageOffers
                      ? 'Manage offers'
                      : ctx?.showViewAgreement
                        ? 'View agreement & pay'
                        : 'Manage offers'
                    : ctx?.showViewAgreement
                      ? 'View agreement & pay'
                      : ctx?.showViewOffer
                        ? 'View offer'
                        : 'Make offer',
                  onClick: () => {
                    if (isCreator && ctx?.showManageOffers) {
                      goNegotiate();
                      return;
                    }
                    goNegotiate();
                  },
              }}
              className="border-0 bg-[#FAFAFF]/80 shadow-none"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {bundle.offers.map((offer) => {
                const offerExpired = isOfferExpired(offer);
              const bidder = bundle.profilesById[offer.bidder_id];
              const whenSnippet = formatProposalSnippet(offer.proposed_scheduled_at);
              const isAccepted = offer.id === plan.accepted_offer_id;
              return (
                <li
                  key={offer.id}
                  className={cn('px-5 py-4', isAccepted && 'bg-emerald-500/[0.04]')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-foreground">
                        {bidder?.display_name?.trim() || 'Guest'}
                      </p>
                      <p className="text-[13px] font-semibold text-primary">
                          {formatOfferAmount(offerLiveAmount(offer))}
                      </p>
                      {whenSnippet ? (
                        <p className="text-[12px] font-semibold text-muted">Proposed · {whenSnippet}</p>
                      ) : null}
                      {offer.message ? (
                        <p className="mt-1 line-clamp-2 text-[12px] font-semibold text-muted">{offer.message}</p>
                      ) : null}
                    </div>
                      <OfferStatusBadge status={offer.status} expired={offerExpired} />
                  </div>
                  {isAccepted ? (
                    <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                      Matched offer
                    </p>
                  ) : null}
                  </li>
                );
              })}
            </ul>
          )
        ) : !bundle?.joinRequests.length ? (
          <div className="px-4 py-6">
            <AppEmptyState
              variant="compact"
              emoji="👋"
              title="No requests yet"
              description="When guests request to join at your listed price, they appear here."
              action={{
                label: 'Manage requests',
                onClick: () => {
                  router.push(`/plan/${planId}/requests`);
                },
              }}
              className="border-0 bg-[#FAFAFF]/80 shadow-none"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {bundle.joinRequests.map((request) => {
              const chip = joinRequestStatusChip(request.status) ?? {
                label: request.status,
                className: 'bg-border text-muted',
              };
              const requester = bundle.profilesById[request.requester_id] ?? request.requester;
              const slotLabel = resolveJoinRequestSlotCentsLabel(plan);
              return (
                <li key={request.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-foreground">
                        {requester?.display_name?.trim() || 'Guest'}
                      </p>
                      {slotLabel ? (
                        <p className="text-[13px] font-semibold text-primary">{slotLabel}</p>
                      ) : null}
                      {request.message ? (
                        <p className="mt-1 line-clamp-2 text-[12px] font-semibold text-muted">{request.message}</p>
                      ) : null}
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-extrabold', chip.className)}>
                      {chip.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      <PlanLocationMap
        latitude={meetupPin?.lat ?? null}
        longitude={meetupPin?.lng ?? null}
        locationLabel={plan.location_label}
      />

      {hostCancelOpen ? (
        <GroupHostCancellationModal
          planId={plan.id}
          onDismiss={() => setHostCancelOpen(false)}
          onCancelled={() => {
            setHostCancelOpen(false);
            router.push('/discover');
          }}
        />
      ) : null}
    </div>
    </GroupPlanPolicyGate>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  iconTone = 'primary',
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  iconTone?: 'primary' | 'fee';
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/40 bg-[#FAFAFF]/80 px-3 py-2.5">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          iconTone === 'fee' ? 'bg-[#059669]/10 text-[#059669]' : 'bg-primary/10 text-primary'
        )}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="text-[13px] font-extrabold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function ActionRail({
  ctx,
  listingExpired,
  saved,
  saveBusy,
  chatBusy,
  calendarBusy,
  canCalendar,
  onSave,
  onNegotiate,
  onViewOffer,
  onAgreement,
  onChat,
  onCalendar,
}: {
  ctx: PlanViewerContext;
  listingExpired: boolean;
  saved: boolean;
  saveBusy: boolean;
  chatBusy: boolean;
  calendarBusy: boolean;
  canCalendar: boolean;
  onSave: () => void;
  onNegotiate: () => void;
  onViewOffer: () => void;
  onAgreement: () => void;
  onChat: () => void;
  onCalendar: () => void;
}) {
  const guestCalendarSaveRow = !!(ctx.showCalendar && ctx.showSave);
  const joinFlowGuestActionsInCard =
    ctx.showRequestToJoin ||
    ctx.showViewRequest ||
    ctx.showPayShare;

    return (
    <>
      {ctx.showSave && ctx.showMakeOffer ? (
        <div className={planActionGrid}>
          <button type="button" className={actionSecondary} onClick={onSave} disabled={saveBusy}>
            {saved ? 'Saved' : 'Save plan'}
          </button>
          <button type="button" className={actionPrimary} onClick={onNegotiate} disabled={listingExpired}>
            Make offer
          </button>
        </div>
      ) : null}

      {ctx.guestActionBlockLabel ? (
        <div className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-border/70 bg-[#F5F6FA] px-5 py-2.5 text-[14px] font-extrabold text-muted">
          {ctx.guestActionBlockLabel}
        </div>
      ) : null}

      {ctx.showSave && ctx.showViewOffer ? (
        <div className={planActionGrid}>
          <button type="button" className={actionSecondary} onClick={onSave} disabled={saveBusy}>
            {saved ? 'Saved' : 'Save plan'}
          </button>
          <button type="button" className={actionPrimary} onClick={onViewOffer}>
            View offer
          </button>
        </div>
      ) : null}

      {guestCalendarSaveRow ? (
        <div className={planActionGrid}>
          <button
            type="button"
            className={actionPrimary}
            onClick={onCalendar}
            disabled={calendarBusy || !canCalendar}
          >
          <span className="inline-flex items-center gap-2">
              <IoCalendarOutline size={18} />
              {calendarBusy ? 'Adding…' : canCalendar ? 'Add to calendar' : 'Set a time first'}
          </span>
        </button>
          <button type="button" className={actionSecondary} onClick={onSave} disabled={saveBusy}>
            {saved ? 'Saved' : 'Save plan'}
        </button>
      </div>
      ) : null}

      {ctx.showSave &&
      !ctx.showMakeOffer &&
      !ctx.showViewOffer &&
      !joinFlowGuestActionsInCard &&
      !guestCalendarSaveRow ? (
        <div className={planActionGrid}>
          <button type="button" className={actionSecondary} onClick={onSave} disabled={saveBusy}>
          {saved ? 'Saved' : 'Save plan'}
        </button>
        </div>
      ) : null}

      {ctx.showViewAgreement && !ctx.showMessage ? (
        <div className={planActionGrid}>
          <button type="button" className={actionSecondary} onClick={() => onAgreement()}>
          <span className="inline-flex items-center gap-2">
            <IoDocumentTextOutline size={18} />
            View agreement & pay
          </span>
        </button>
        </div>
      ) : null}

      {ctx.showViewAgreement && ctx.showMessage ? (
        <div className={planActionGrid}>
          <button type="button" className={actionSecondary} onClick={() => onAgreement()}>
            <span className="inline-flex items-center gap-2">
              <IoDocumentTextOutline size={18} />
              View agreement & pay
            </span>
          </button>
          <button type="button" className={actionPrimary} onClick={onChat} disabled={chatBusy}>
          <span className="inline-flex items-center gap-2">
            <IoChatbubbleEllipsesOutline size={18} />
            Message
          </span>
        </button>
      </div>
      ) : null}
    </>
  );
}
