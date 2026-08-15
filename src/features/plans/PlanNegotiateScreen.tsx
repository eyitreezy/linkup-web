'use client';

import { GroupHostManageSection } from '@/components/plans/group/GroupHostManageSection';
import { GroupSuggestedShareAnchor } from '@/components/plans/group/GroupSuggestedShareAnchor';
import { OfferFeeBreakdown } from '@/components/plans/OfferFeeBreakdown';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { CounterOfferDialog } from '@/features/plans/negotiation/CounterOfferDialog';
import { NegotiationOfferCard } from '@/features/plans/negotiation/NegotiationOfferCard';
import { OfferBubble } from '@/features/plans/negotiation/OfferBubble';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { openPlanMeetupChatPath } from '@/lib/messaging/openPlanMeetupChat';
import { isPlanListingExpired } from '@/lib/plans/planExpiry';
import {
  bidderHasActiveGroupSlotOffer,
  countOffersTowardLimit,
  countOffersTowardLimitForBidder,
  MAX_OFFERS_PER_PLAN,
} from '@/lib/plans/offerRules';
import {
  guestRespondToCounter,
  hostRespondToOffer,
  withdrawOffer,
} from '@/lib/plans/negotiationActions';
import { formatNegotiationRpcError } from '@/lib/plans/negotiationRpcErrors';
import { deriveNegotiationContext, isOfferLive } from '@/lib/plans/negotiationState';
import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import {
  resolvePlanAgreementHref,
  shouldRedirectFromNegotiate,
} from '@/lib/plans/planAgreementRoute';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { fetchOffersForPlan, submitPlanOffer } from '@/services/planOffers.service';
import { fetchPlanById } from '@/services/plans.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { usePlanOffersRealtime } from '@/hooks/useOffersRealtime';
import { useAuthStore } from '@/stores/auth-store';
import type { DbPlanOffer } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  offerId?: string | null;
  openAction?: string | null;
};

type ConfirmKind = 'accept' | 'decline' | 'withdraw';

export function PlanNegotiateScreen({ planId, offerId, openAction }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proposedAt, setProposedAt] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [counterOffer, setCounterOffer] = useState<DbPlanOffer | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; offer: DbPlanOffer } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [statusAlert, setStatusAlert] = useState<{ title: string; message: string } | null>(null);

  usePlanOffersRealtime(planId);

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

  const planQuery = useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchPlanById(client, planId);
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Plan not found');
      return data;
    },
  });

  const offersQuery = useQuery({
    queryKey: ['plan-offers', planId],
    queryFn: async () => {
      const client = createClient();
      return fetchOffersForPlan(client, planId, true);
    },
  });

  const plan = planQuery.data;
  const offers = offersQuery.data ?? [];
  const isCreator = !!user?.id && plan?.creator_id === user.id;
  const isGroupSplit = plan ? isGroupSplitPlan(plan) : false;
  const planListingExpired = plan ? isPlanListingExpired(plan) : false;
  const canNegotiate = plan?.status === 'negotiating' && !planListingExpired;
  const dbUser = profileQuery.data?.dbUser ?? null;

  const sortedOffers = useMemo(
    () => [...offers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [offers]
  );

  const flowAdvance = useMemo(
    () => (plan ? shouldRedirectFromNegotiate(plan, user?.id, sortedOffers) : { redirect: false, href: '' }),
    [plan, user?.id, sortedOffers]
  );

  useEffect(() => {
    if (offersQuery.isLoading || planQuery.isLoading || !flowAdvance.redirect) return;
    router.replace(flowAdvance.href);
  }, [offersQuery.isLoading, planQuery.isLoading, flowAdvance, router]);

  const liveOffers = useMemo(() => sortedOffers.filter((o) => isOfferLive(o)), [sortedOffers]);

  const guestLiveOffers = useMemo(
    () => (user ? liveOffers.filter((o) => o.bidder_id === user.id) : []),
    [liveOffers, user]
  );

  const hostSelectableOffers = useMemo(
    () => (plan ? liveOffers.filter((o) => o.bidder_id !== plan.creator_id) : []),
    [liveOffers, plan]
  );

  useEffect(() => {
    if (!isCreator) return;
    if (offerId && hostSelectableOffers.some((o) => o.id === offerId)) {
      setSelectedOfferId(offerId);
      return;
    }
    if (selectedOfferId && hostSelectableOffers.some((o) => o.id === selectedOfferId)) return;
    setSelectedOfferId(hostSelectableOffers[hostSelectableOffers.length - 1]?.id ?? null);
  }, [isCreator, hostSelectableOffers, selectedOfferId, offerId]);

  const focusOffer = isCreator
    ? (hostSelectableOffers.find((o) => o.id === selectedOfferId) ??
      (offerId ? hostSelectableOffers.find((o) => o.id === offerId) : null) ??
      hostSelectableOffers[hostSelectableOffers.length - 1] ??
      null)
    : ((offerId ? guestLiveOffers.find((o) => o.id === offerId) : null) ??
      guestLiveOffers[guestLiveOffers.length - 1] ??
      null);

  const counterOpenedRef = useRef(false);
  const amountPrefilledRef = useRef(false);

  useEffect(() => {
    if (counterOpenedRef.current || openAction !== 'counter' || !focusOffer || !user?.id || !plan) return;
    const ctx = deriveNegotiationContext(focusOffer, plan, user.id);
    if (ctx.isLive && ctx.isMyTurn) {
      counterOpenedRef.current = true;
      setCounterOffer(focusOffer);
    }
  }, [openAction, focusOffer, plan, user?.id]);

  const counterTarget = guestLiveOffers.find((o) => o.status === 'countered_by_host') ?? null;

  const guestAcceptedOffer = useMemo(() => {
    if (isCreator || !user?.id) return null;
    return sortedOffers.find((o) => o.bidder_id === user.id && o.status === 'accepted') ?? null;
  }, [sortedOffers, isCreator, user?.id]);

  const acceptedPanelOffer = useMemo(() => {
    if (offerId) {
      const fromUrl = sortedOffers.find((o) => o.id === offerId && o.status === 'accepted');
      if (fromUrl) return fromUrl;
    }
    return guestAcceptedOffer;
  }, [offerId, sortedOffers, guestAcceptedOffer]);

  const panelOffer = focusOffer ?? acceptedPanelOffer;
  const showActionPanel = Boolean(panelOffer && (canNegotiate || panelOffer.status === 'accepted'));

  useEffect(() => {
    if (!plan || !isGroupSplit || amountPrefilledRef.current || counterTarget) return;
    const suggested = plan.current_suggested_share_cents;
    if (suggested != null && suggested > 0) {
      setAmount(String(suggested / 100));
      amountPrefilledRef.current = true;
    }
  }, [plan, isGroupSplit, counterTarget]);

  const bidderNamesQuery = useQuery({
    queryKey: ['offer-bidders', planId, offers.map((o) => o.bidder_id).join(',')],
    queryFn: async () => {
      const ids = [...new Set(offers.map((o) => o.bidder_id))];
      if (ids.length === 0) return new Map<string, string>();
      const client = createClient();
      const { data } = await client
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        map.set(row.user_id as string, (row.display_name as string | null)?.trim() || 'Guest');
      }
      if (plan) map.set(plan.creator_id, plan.creator?.display_name?.trim() || 'Host');
      return map;
    },
    enabled: offers.length > 0 || !!plan,
  });

  const profilesByBidder = bidderNamesQuery.data ?? new Map<string, string>();

  function showError(message: string) {
    setStatusAlert({ title: 'Could not continue', message: formatNegotiationRpcError(message) });
  }

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !plan) throw new Error('Sign in to send an offer.');
      if (requiresVerificationGate(dbUser?.verification_status)) {
        setGateOpen(true);
        throw new Error('verification');
      }

      const myWaiting = guestLiveOffers.find(
        (o) => o.awaiting_response_from === 'host' && o.status !== 'countered_by_host'
      );
      if (myWaiting && !counterTarget) {
        throw new Error('Wait for the host to respond or withdraw your offer.');
      }

      if (plan.is_group_plan) {
        const active = bidderHasActiveGroupSlotOffer(offers, user.id);
        if (active?.status === 'accepted') {
          throw new Error('You already have an accepted slot on this plan.');
        }
        if (active && !counterTarget) {
          throw new Error('You already have an active slot request on this plan.');
        }
        if (countOffersTowardLimitForBidder(offers, user.id) >= MAX_OFFERS_PER_PLAN && !counterTarget) {
          throw new Error(`Offer limit reached (${MAX_OFFERS_PER_PLAN} rounds).`);
        }
      } else if (countOffersTowardLimit(offers) >= MAX_OFFERS_PER_PLAN && !counterTarget) {
        throw new Error(`Offer limit reached (${MAX_OFFERS_PER_PLAN} rounds).`);
      }

      const cents = amount.trim() ? Math.round(Number(amount) * 100) : null;
      if (cents != null && (Number.isNaN(cents) || cents < 0)) {
        throw new Error('Enter a valid amount or leave blank.');
      }

      const client = createClient();
      const res = await submitPlanOffer(client, {
        planId: plan.id,
        amountCents: cents,
        message: note.trim() || null,
        proposedScheduledAt: proposedAt ? new Date(proposedAt).toISOString() : null,
        offerId: counterTarget?.id ?? null,
      });
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      setAmount('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'verification') return;
      showError(e instanceof Error ? e.message : 'Could not send offer');
    },
  });

  async function runConfirmAction() {
    if (!confirm || !user?.id || !plan) return;
    const { kind, offer } = confirm;
    const ctx = deriveNegotiationContext(offer, plan, user.id);
    setActionBusy(true);
    const client = createClient();
    let error: string | null = null;

    if (kind === 'accept') {
      const res = ctx.isHost
        ? await hostRespondToOffer(client, { offerId: offer.id, action: 'accept' })
        : await guestRespondToCounter(client, { offerId: offer.id, action: 'accept' });
      error = res.error;
      if (!error) {
        void queryClient.invalidateQueries({ queryKey: ['plan', planId] });
        void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
        const href = plan.is_group_plan
          ? resolvePlanAgreementHref(plan, { offerId: offer.id })
          : resolvePlanAgreementHref(plan);
        router.replace(href);
      }
    } else if (kind === 'decline') {
      const res = ctx.isHost
        ? await hostRespondToOffer(client, { offerId: offer.id, action: 'decline' })
        : await guestRespondToCounter(client, { offerId: offer.id, action: 'decline' });
      error = res.error;
      if (!error) {
        void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
      }
    } else if (kind === 'withdraw') {
      const res = await withdrawOffer(client, offer.id);
      error = res.error;
      if (!error) {
        void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
      }
    }

    setActionBusy(false);
    setConfirm(null);
    if (error) showError(error);
  }

  async function handleCounterSubmit(
    amountCents: number | null,
    counterNote: string,
    proposedScheduledAt: string | null
  ) {
    if (!counterOffer || !user?.id || !plan) return;
    const ctx = deriveNegotiationContext(counterOffer, plan, user.id);
    setActionBusy(true);
    const client = createClient();
    const res = ctx.isHost
      ? await hostRespondToOffer(client, {
          offerId: counterOffer.id,
          action: 'counter',
          counterAmountCents: amountCents,
          note: counterNote || null,
          proposedScheduledAt,
        })
      : await guestRespondToCounter(client, {
          offerId: counterOffer.id,
          action: 'counter',
          counterAmountCents: amountCents,
          note: counterNote || null,
          proposedScheduledAt,
        });
    setActionBusy(false);
    setCounterOffer(null);
    if (res.error) showError(res.error);
    else void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
  }

  async function openDm() {
    if (!user?.id || !plan) return;
    try {
      const client = createClient();
      const path = await openPlanMeetupChatPath(client, {
        plan,
        userId: user.id,
        isCreator,
        offers: sortedOffers,
      });
      router.push(path);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  if (planQuery.isLoading) {
    return <p className="text-[14px] font-semibold text-muted">Loading negotiation…</p>;
  }

  if (!plan) {
    return (
      <div className="linkup-card px-6 py-10 text-center">
        <p className="font-extrabold text-foreground">Plan not found</p>
        <Link href="/discover" className="mt-3 inline-block font-extrabold text-primary underline">
          Discover
        </Link>
      </div>
    );
  }

  if (!offersQuery.isLoading && flowAdvance.redirect) {
    return <p className="text-[14px] font-semibold text-muted">Opening agreement…</p>;
  }

  const offerBudgetCents = amount.trim() ? Math.round(Number(amount) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
      <AppStatusDialog
        open={statusAlert !== null}
        variant="error"
        title={statusAlert?.title ?? ''}
        message={statusAlert?.message ?? ''}
        onClose={() => setStatusAlert(null)}
      />
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'accept'
            ? 'Accept this offer?'
            : confirm?.kind === 'decline'
              ? 'Decline this offer?'
              : 'Withdraw your offer?'
        }
        message={
          confirm?.kind === 'accept'
            ? 'You will move on to the agreement and payment steps next.'
            : confirm?.kind === 'decline'
              ? 'This will end the negotiation. The other party will be notified.'
              : 'Take back your offer. You can submit a new one if you change your mind.'
        }
        cancelLabel="Cancel"
        confirmLabel={
          confirm?.kind === 'accept' ? 'Accept' : confirm?.kind === 'decline' ? 'Decline' : 'Withdraw'
        }
        confirmVariant={confirm?.kind === 'decline' ? 'danger' : 'neutral'}
        busy={actionBusy}
        onClose={() => !actionBusy && setConfirm(null)}
        onConfirm={() => void runConfirmAction()}
      />
      <CounterOfferDialog
        open={counterOffer !== null}
        offer={counterOffer}
        planId={planId}
        busy={actionBusy}
        onClose={() => !actionBusy && setCounterOffer(null)}
        onSubmit={(cents, n, at) => void handleCounterSubmit(cents, n, at)}
      />

      <PlanFlowHeader
        kicker="Offers"
        title={isCreator ? 'Manage offers' : 'Make an offer'}
        subtitle={plan.title}
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
        right={
          <button
            type="button"
            onClick={() => void openDm()}
            className="flex items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-[13px] font-extrabold text-primary shadow-sm"
          >
            <IoChatbubbleEllipsesOutline size={18} />
            Open chat
          </button>
        }
      />

      <div className="linkup-card space-y-3 p-4 text-[13px] font-semibold text-muted">
        <p>
          {isCreator
            ? 'Accept, counter, or decline each offer. Up to 5 rounds per guest. Amounts update with each counter.'
            : 'Propose amount, timing, and a note. When the host counters, you can accept, counter back, or decline.'}
        </p>
      </div>

      <div className="space-y-4">
        {!offersQuery.isLoading && sortedOffers.length === 0 ? (
          <AppEmptyState
            emoji="🤝"
            title={isCreator ? 'Waiting for offers' : 'Start the conversation'}
            description={
              isCreator
                ? 'When guests send suggestions they appear here with live negotiation controls.'
                : 'Send your first suggestion below with amount, time, and a friendly note.'
            }
            className="border border-dashed border-primary/20"
          />
        ) : null}
        {sortedOffers.map((offer) => {
          const mine = offer.bidder_id === user?.id;
          const liveSelectable =
            isCreator && isOfferLive(offer) && offer.bidder_id !== plan.creator_id && !planListingExpired;
          return (
            <OfferBubble
              key={offer.id}
              offer={offer}
              bidderName={profilesByBidder.get(offer.bidder_id) ?? 'Guest'}
              isOwn={mine}
              isHost={isCreator}
              selected={liveSelectable && offer.id === focusOffer?.id}
              onSelect={liveSelectable ? () => setSelectedOfferId(offer.id) : undefined}
            />
          );
        })}
      </div>

      {guestAcceptedOffer && !(showActionPanel && panelOffer?.id === guestAcceptedOffer.id) ? (
        <div className="linkup-card space-y-3 p-5">
          <p className="text-[14px] font-semibold leading-relaxed text-muted">
            Your offer has been accepted. Review and complete your agreement to secure your spot.
          </p>
          <Link
            href={resolvePlanAgreementHref(plan, { offerId: guestAcceptedOffer.id })}
            className="flex w-full items-center justify-center rounded-full linkup-gradient-primary py-2.5 text-[14px] font-extrabold text-white transition hover:opacity-95"
          >
            View agreement
          </Link>
        </div>
      ) : null}

      {isCreator && user?.id && isGroupSplit ? (
        <GroupHostManageSection
          plan={plan}
          planId={planId}
          userId={user.id}
          onError={(message) => showError(message)}
        />
      ) : null}

      {showActionPanel && panelOffer ? (
        <NegotiationOfferCard
          offer={panelOffer}
          plan={plan}
          currentUserId={user?.id}
          bidderName={profilesByBidder.get(panelOffer.bidder_id)}
          busy={actionBusy}
          onAccept={() => {
            if (requiresVerificationGate(dbUser?.verification_status)) {
              setGateOpen(true);
              return;
            }
            setConfirm({ kind: 'accept', offer: panelOffer });
          }}
          onCounter={() => setCounterOffer(panelOffer)}
          onDecline={() => setConfirm({ kind: 'decline', offer: panelOffer })}
          onWithdraw={() => setConfirm({ kind: 'withdraw', offer: panelOffer })}
        />
      ) : null}

      {!isCreator && canNegotiate ? (
        <form
          className="linkup-card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            sendMutation.mutate();
          }}
        >
          <h3 className="font-display text-lg font-extrabold text-foreground">
            {counterTarget ? 'Respond to host counter' : 'Send a suggestion'}
          </h3>
          {counterTarget ? (
            <p className="text-[13px] font-semibold text-muted">
              The host countered your offer. Submitting below sends your counter, or use Accept / Decline above.
            </p>
          ) : null}
          {isGroupSplit ? <GroupSuggestedShareAnchor plan={plan} /> : null}
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">Amount (₦, optional)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
              placeholder="e.g. 5000"
            />
            {offerBudgetCents > 0 ? (
              <div className="pt-1">
                <OfferFeeBreakdown budgetCents={offerBudgetCents} showDivider />
              </div>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">Proposed time</span>
            <input
              type="datetime-local"
              value={proposedAt}
              onChange={(e) => setProposedAt(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
              placeholder="What would make this meetup work for you?"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {['Tonight works', 'Flexible on time', 'Happy to split cost'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setNote((n) => (n.includes(chip) ? n : n ? `${n}\n${chip}` : chip))}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-extrabold text-primary"
              >
                {chip}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="w-full rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {sendMutation.isPending ? 'Sending…' : counterTarget ? 'Send counter' : 'Send suggestion'}
          </button>
        </form>
      ) : null}

      {planListingExpired ? (
        <p className="text-center text-[13px] font-semibold text-slate-700">
          This plan has ended. New offers are not accepted.
        </p>
      ) : null}
    </div>
  );
}
