'use client';

import { GroupEscrowStatusCard } from '@/components/escrow/GroupEscrowStatusCard';
import { HighValueEscrowModal } from '@/components/escrow/HighValueEscrowModal';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { CancellationSummaryCard } from '@/components/plans/CancellationSummaryCard';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { formatOfferAmount, formatProposalSnippet } from '@/features/plans/planDetailUtils';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import {
  GOODWILL_TIER_MULTIPLIER,
  goodwillCreditCents,
  goodwillCreditCentsForTier,
} from '@/lib/plans/cancellationPolicy';
import { confirmFreePlan, proceedToSecurePayment } from '@/lib/plans/planAgreementActions';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { fetchPlanById } from '@/services/plans.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { IoChatbubbleEllipsesOutline, IoClose, IoShieldCheckmark } from 'react-icons/io5';

interface CancellationOutcome {
  goodwill_credit: number;
  guest_credit: number;
  host_credit: number;
  cancel_type: 'early' | 'late' | 'no_show';
  band: string | null;
}

type Props = { planId: string };

export function PlanAgreementScreen({ planId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'free' | 'pay' | 'ack' | null>(null);
  const [highValueModal, setHighValueModal] = useState<'platinum' | 'self' | 'counterparty' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelOptionsOpen, setCancelOptionsOpen] = useState(false);
  const [noShowConfirmOpen, setNoShowConfirmOpen] = useState(false);
  const [mutualCancelOpen, setMutualCancelOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [cancellationOutcome, setCancellationOutcome] = useState<CancellationOutcome | null>(null);
  const [hasVotedMutualCancel, setHasVotedMutualCancel] = useState(false);
  const [mutualVoteCount, setMutualVoteCount] = useState(0);
  const [mutualToast, setMutualToast] = useState<string | null>(null);

  const { subscriptionState } = useSubscriptionContext();

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
    queryKey: ['plan-agreement', planId],
    queryFn: async () => {
      const client = createClient();
      const { data: plan, error } = await fetchPlanById(client, planId);
      if (error) throw new Error(error.message);
      if (!plan) throw new Error('Plan not found');
      if (!plan.accepted_offer_id) throw new Error('No accepted offer yet');

      const { data: offer } = await client
        .from('plan_offers')
        .select('*')
        .eq('id', plan.accepted_offer_id)
        .single();
      if (!offer) throw new Error('Accepted offer not found');

      const ids = [plan.creator_id, (offer as DbPlanOffer).bidder_id];
      const { data: profs } = await client
        .from('profiles')
        .select('user_id, display_name, avatar_url, verified_badge')
        .in('user_id', ids);

      const { data: confirmations } = await client
        .from('agreement_confirmations')
        .select('user_id')
        .eq('plan_id', planId);

      const { data: escrow } = await client
        .from('escrow_transactions')
        .select('id, status, amount_cents')
        .eq('plan_id', planId)
        .maybeSingle();

      const { data: mutualVotes } = await client
        .from('mutual_plan_cancel_votes')
        .select('user_id')
        .eq('plan_id', planId);

      const voteIds = (mutualVotes ?? []).map((r) => r.user_id as string);

      return {
        plan,
        offer: offer as DbPlanOffer,
        profiles: profs ?? [],
        confirmationUserIds: (confirmations ?? []).map((c) => c.user_id as string),
        escrowId: escrow?.id as string | undefined,
        escrowCents: (escrow?.amount_cents as number | undefined) ?? null,
        mutualVoteIds: voteIds,
      };
    },
    retry: false,
  });

  const dbUser = profileQuery.data?.dbUser ?? null;
  const data = agreementQuery.data;
  const plan = data?.plan;
  const offer = data?.offer;
  const isHost = !!user?.id && plan?.creator_id === user.id;
  const isBidder = !!user?.id && offer?.bidder_id === user.id;
  const isGuest = isBidder;

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
            setMutualToast('Plan mutually cancelled — refund processed.');
            setTimeout(() => router.push('/discover'), 1500);
          }
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [planId, hasVotedMutualCancel, router]);
  const paymentRequired = !!plan?.is_paid;
  const bothConfirmed = (data?.confirmationUserIds.length ?? 0) >= 2;
  const userConfirmed = user?.id ? data?.confirmationUserIds.includes(user.id) : false;
  const needsConfirm = plan?.status === 'agreed';
  const awaitingPay = plan?.status === 'awaiting_payment';

  const hostProfile = useMemo(
    () => data?.profiles.find((p) => p.user_id === plan?.creator_id),
    [data?.profiles, plan?.creator_id]
  );
  const guestProfile = useMemo(
    () => data?.profiles.find((p) => p.user_id === offer?.bidder_id),
    [data?.profiles, offer?.bidder_id]
  );

  function openLegalGate(action: 'free' | 'pay' | 'ack') {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setPendingAction(action);
    setLegalOpen(true);
  }

  async function onLegalConfirm() {
    if (!user?.id || !plan) return;
    setBusy(true);
    const client = createClient();
    const { error } = await client.rpc('record_agreement_confirmation', { p_plan_id: plan.id });
    if (error) {
      setBusy(false);
      window.alert(error.message);
      return;
    }
    const { data: refreshed } = await client
      .from('agreement_confirmations')
      .select('user_id')
      .eq('plan_id', plan.id);
    const ids = (refreshed ?? []).map((r) => r.user_id as string);
    const complete = new Set(ids).size >= 2;
    const action = pendingAction;
    setLegalOpen(false);
    setPendingAction(null);
    void queryClient.invalidateQueries({ queryKey: ['plan-agreement', planId] });
    if (complete) {
      if (action === 'free') await runConfirmFree();
      else if (action === 'pay' && isBidder) await runProceedPayment();
    }
    setBusy(false);
  }

  async function runConfirmFree() {
    if (!plan) return;
    setBusy(true);
    const client = createClient();
    const { error } = await confirmFreePlan(client, plan.id);
    setBusy(false);
    if (error) window.alert(error);
    else router.push(`/plan/${planId}`);
  }

  async function runProceedPayment() {
    if (!plan || !offer) return;
    setBusy(true);
    const client = createClient();
    const res = await proceedToSecurePayment(client, plan, offer);
    setBusy(false);
    if (res.error) {
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
      window.alert(res.error);
      return;
    }
    if (res.escrowId) router.push(`/escrow/${res.escrowId}`);
  }

  async function handleCancel({ noShow }: { noShow: boolean }) {
    if (!plan || busy) return;
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
      window.alert(error.message);
      return;
    }
    setCancellationOutcome(outcome as CancellationOutcome);
    setOutcomeOpen(true);
  }

  async function handleVoteMutualCancel() {
    if (busy) return;
    setBusy(true);
    const client = createClient();
    const { data, error } = await client.rpc('vote_mutual_plan_cancel', { p_plan_id: planId });
    setBusy(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    const result = data as { status?: string };
    if (result.status === 'completed') {
      setMutualCancelOpen(false);
      setMutualToast('Plan mutually cancelled — refund processed.');
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

  async function onMessage() {
    if (!user?.id || !plan || !offer) return;
    const otherId = isHost ? offer.bidder_id : plan.creator_id;
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, user.id, otherId);
      router.push(path);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  if (agreementQuery.isLoading) {
    return <p className="text-[14px] font-semibold text-muted">Loading agreement…</p>;
  }

  if (agreementQuery.isError || !plan || !offer) {
    return (
      <div className="linkup-card px-6 py-10 text-center">
        <p className="font-extrabold text-foreground">
          {agreementQuery.error instanceof Error
            ? agreementQuery.error.message
            : 'Agreement not available'}
        </p>
        <Link href={`/plan/${planId}`} className="mt-3 inline-block font-extrabold text-primary underline">
          Back to plan
        </Link>
      </div>
    );
  }

  const agreedAmount = plan.agreed_price_cents ?? offer.amount_cents;
  const schedule = plan.agreed_scheduled_at ?? offer.proposed_scheduled_at ?? plan.scheduled_at;
  const showCancelPlan = needsConfirm || awaitingPay;
  const escrowCents = data?.escrowCents ?? agreedAmount;
  const guestTier = (subscriptionState.effectiveTier ?? 'FREE') as SubscriptionTier;
  const noShowGoodwillPreview = isGuest
    ? goodwillCreditCentsForTier(goodwillCreditCents(escrowCents ?? 0), guestTier)
    : 0;

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

  if (plan.status === 'active') {
    primaryLabel = 'View active plan';
  } else if (awaitingPay) {
    if (isBidder) {
      primaryLabel = 'Continue to secure payment';
      onPrimary = () => void runProceedPayment();
    } else {
      primaryLabel = 'Waiting for guest payment';
      primaryDisabled = true;
      onPrimary = () => {};
    }
  } else if (needsConfirm) {
    if (!userConfirmed) {
      if (!paymentRequired) {
        primaryLabel = 'Review & confirm plan';
        onPrimary = () => openLegalGate('free');
      } else if (isBidder) {
        primaryLabel = 'Review terms & pay';
        onPrimary = () => openLegalGate('pay');
      } else {
        primaryLabel = 'Review & confirm terms';
        onPrimary = () => openLegalGate('ack');
      }
      primaryDisabled = busy;
    } else if (!bothConfirmed) {
      primaryLabel = 'Waiting for the other person';
      primaryDisabled = true;
      onPrimary = () => {};
    } else if (!paymentRequired) {
      primaryLabel = 'Confirm plan';
      onPrimary = () => void runConfirmFree();
      primaryDisabled = busy;
    } else if (isBidder) {
      primaryLabel = 'Proceed to secure payment';
      onPrimary = () => void runProceedPayment();
      primaryDisabled = busy;
    } else {
      primaryLabel = 'Waiting for guest payment';
      primaryDisabled = true;
      onPrimary = () => {};
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
      <HighValueEscrowModal
        open={highValueModal !== null}
        variant={highValueModal ?? 'self'}
        onClose={() => setHighValueModal(null)}
      />
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
              Standard cancellation — see refund policy below
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
              Report a no-show — full refund
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
            Both parties agree to cancel with a full refund to whoever funded escrow. No cancellation fees or
            strikes apply. The other person must also confirm.
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
            <CancellationSummaryCard outcome={outcomeCardProps} />
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

      {legalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl font-extrabold">Terms & safety</h2>
            <p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted">
              By confirming, you agree to LinkUp meetup policies: show up as planned, communicate changes in-app,
              and use escrow for paid plans. Off-platform payment bypasses protection.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onLegalConfirm()}
                className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
              >
                I agree
              </button>
              <button
                type="button"
                onClick={() => {
                  setLegalOpen(false);
                  setPendingAction(null);
                }}
                className="rounded-full border border-border px-5 py-2.5 text-[14px] font-extrabold text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PlanFlowHeader
        kicker="Agreement"
        title="Confirm your meetup"
        subtitle={plan.title}
        backHref={`/plan/${planId}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <PartyCard label="Host" profile={hostProfile} />
        <PartyCard label="Guest" profile={guestProfile} />
      </div>

      <section className="linkup-card space-y-4 p-5">
        <h3 className="font-display text-lg font-extrabold">Plan summary</h3>
        <dl className="grid gap-3 text-[14px]">
          <div>
            <dt className="text-[11px] font-extrabold uppercase text-muted">When</dt>
            <dd className="font-extrabold text-foreground">
              {schedule ? formatProposalSnippet(schedule) ?? formatPlanWhen(plan) : formatPlanWhen(plan)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold uppercase text-muted">Where</dt>
            <dd className="font-extrabold text-foreground">
              {plan.agreed_location ?? plan.location_label ?? 'TBD'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold uppercase text-muted">Price</dt>
            <dd className="font-extrabold text-primary">{formatOfferAmount(agreedAmount)}</dd>
          </div>
          {plan.agreed_notes || offer.message ? (
            <div>
              <dt className="text-[11px] font-extrabold uppercase text-muted">Notes</dt>
              <dd className="font-semibold text-muted">{plan.agreed_notes ?? offer.message}</dd>
            </div>
          ) : null}
        </dl>
        <p className="rounded-xl bg-primary/5 px-3 py-2 text-[12px] font-semibold text-muted">
          Escrow pattern {plan.escrow_pattern ?? 'A'}
          {paymentRequired ? ' · Paid plan — fund via secure checkout after both confirm.' : ' · Free plan.'}
        </p>
      </section>

      {plan.is_group_plan ? (
        <GroupEscrowStatusCard planId={planId} isGroupPlan={!!plan.is_group_plan} isHost={!!isHost} />
      ) : null}

      <CancellationSummaryCard />

      {mutualToast ? (
        <p className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[14px] font-semibold text-[#059669]">
          {mutualToast}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={primaryDisabled || busy}
          onClick={onPrimary}
          className="rounded-full linkup-gradient-primary px-6 py-3 text-[14px] font-extrabold text-white disabled:opacity-50"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => void onMessage()}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 px-6 py-3 text-[14px] font-extrabold text-primary"
        >
          <IoChatbubbleEllipsesOutline size={18} />
          Message
        </button>
      </div>

      {showCancelPlan ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMutualCancelOpen(true)}
            className="text-[14px] font-extrabold text-primary underline disabled:opacity-50"
          >
            Suggest mutual cancellation
          </button>
          {isGuest ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setCancelOptionsOpen(true)}
              className="text-[14px] font-semibold text-muted underline hover:text-foreground disabled:opacity-50"
            >
              Cancel this plan
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
              className="text-[14px] font-semibold text-muted underline hover:text-foreground disabled:opacity-50"
            >
              Cancel this plan
            </button>
          )}
        </div>
      ) : null}
    </div>
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

function PartyCard({
  label,
  profile,
}: {
  label: string;
  profile?: { display_name: string | null; avatar_url: string | null; verified_badge?: boolean | null };
}) {
  return (
    <div className="linkup-card flex items-center gap-3 p-4">
      <AvatarWithPresence
        uri={profile?.avatar_url}
        name={profile?.display_name ?? label}
        size={44}
        presence={null}
        showDot={false}
      />
      <div>
        <p className="text-[11px] font-extrabold uppercase text-muted">{label}</p>
        <div className="flex items-center gap-1">
          <p className="font-extrabold text-foreground">{profile?.display_name?.trim() || 'Member'}</p>
          {profile?.verified_badge ? <IoShieldCheckmark className="text-emerald-600" size={14} /> : null}
        </div>
      </div>
    </div>
  );
}
