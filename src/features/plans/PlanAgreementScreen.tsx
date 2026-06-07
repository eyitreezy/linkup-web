'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { formatOfferAmount, formatProposalSnippet } from '@/features/plans/planDetailUtils';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { confirmFreePlan, proceedToSecurePayment } from '@/lib/plans/planAgreementActions';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { fetchPlanById } from '@/services/plans.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IoChatbubbleEllipsesOutline, IoShieldCheckmark } from 'react-icons/io5';

type Props = { planId: string };

export function PlanAgreementScreen({ planId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'free' | 'pay' | 'ack' | null>(null);

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
        .select('id, status')
        .eq('plan_id', planId)
        .maybeSingle();

      return {
        plan,
        offer: offer as DbPlanOffer,
        profiles: profs ?? [],
        confirmationUserIds: (confirmations ?? []).map((c) => c.user_id as string),
        escrowId: escrow?.id as string | undefined,
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
      window.alert(res.error);
      return;
    }
    if (res.escrowId) router.push(`/escrow/${res.escrowId}`);
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
