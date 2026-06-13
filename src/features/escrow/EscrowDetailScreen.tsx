'use client';

import { EscrowNoticeBanner } from '@/components/escrow/EscrowNoticeBanner';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { OpenDisputeModal } from '@/components/escrow/OpenDisputeModal';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { useEscrowFunding } from '@/hooks/useEscrowFunding';
import { useEscrowRealtime } from '@/hooks/useEscrowRealtime';
import {
  confirmMeetupComplete,
  openEscrowDisputeWithTicket,
  releaseEscrowFunds,
} from '@/lib/escrow/escrowActions';
import { formatEscrowDate, formatNGN, getReleaseRecipientLabel } from '@/lib/escrow/escrowFormatters';
import { platformFeeCentsForAmount } from '@/lib/plans/planFinancialConfig';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbEscrowTransaction, EscrowPattern } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import {
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircle,
  IoPeople,
  IoShieldCheckmark,
  IoSparkles,
  IoTimeOutline,
} from 'react-icons/io5';

type EscrowRow = DbEscrowTransaction & {
  plans: {
    title: string;
    location_label: string | null;
    is_group_plan?: boolean | null;
    status: string;
  } | null;
};

type PartyNames = { hostName: string; guestName: string };

function EscrowDetailContent({ escrowId }: { escrowId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { dbUser, subscriptionState } = useSubscriptionContext();
  const { fundEscrow, busy: fundBusy } = useEscrowFunding();
  const [gateOpen, setGateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);
  const [slaDeadline, setSlaDeadline] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['escrow', escrowId],
    queryFn: async () => {
      const client = createClient();
      const { data: row, error: err } = await client
        .from('escrow_transactions')
        .select('*, plans(title, location_label, is_group_plan, status)')
        .eq('id', escrowId)
        .single();
      if (err) throw new Error(err.message);

      const esc = row as EscrowRow;
      const partyIds = [esc.host_id, esc.guest_id].filter(Boolean) as string[];
      let names: PartyNames = { hostName: 'Host', guestName: 'Guest' };
      if (partyIds.length) {
        const { data: profs } = await client
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', partyIds);
        const map = new Map((profs ?? []).map((p) => [p.user_id as string, p.display_name as string]));
        if (esc.host_id) names = { ...names, hostName: map.get(esc.host_id) ?? 'Host' };
        if (esc.guest_id) names = { ...names, guestName: map.get(esc.guest_id) ?? 'Guest' };
      }
      return { escrow: esc, names };
    },
  });

  const escrow = data?.escrow ?? null;
  const names = data?.names ?? { hostName: 'Host', guestName: 'Guest' };

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
          showToast('Escrow fully funded — plan is now active');
        }
        const role =
          user?.id === prev?.host_id ? 'host' : user?.id === prev?.guest_id ? 'guest' : null;
        if (next.host_funded_at && !prev?.host_funded_at && role === 'guest') {
          showToast('Host has funded their share. Your turn to fund.');
        }
        if (next.guest_funded_at && !prev?.guest_funded_at && role === 'host') {
          showToast('Guest has funded their share. Your turn to fund.');
        }
      },
      [escrowId, queryClient, showToast, user?.id]
    )
  );

  async function onMessage() {
    if (!user?.id || !escrow) return;
    const other =
      user.id === escrow.host_id
        ? escrow.guest_id
        : user.id === escrow.guest_id
          ? escrow.host_id
          : user.id === escrow.payer_id
            ? escrow.payee_id
            : escrow.payer_id;
    if (!other) return;
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, user.id, other);
      router.push(path);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  function canUserFund(): boolean {
    if (!user?.id || !escrow || escrow.status !== 'pending_funding') return false;
    if (escrow.escrow_pattern === 'B') {
      if (user.id === escrow.host_id && !escrow.host_funded_at) return true;
      if (user.id === escrow.guest_id && !escrow.guest_funded_at) return true;
      return false;
    }
    return user.id === escrow.payer_id;
  }

  function fundLabel(): string {
    if (!escrow) return 'Pay with Flutterwave';
    if (escrow.escrow_pattern === 'B') {
      if (user?.id === escrow.host_id && !escrow.host_funded_at) return 'Pay your host share';
      if (user?.id === escrow.guest_id && !escrow.guest_funded_at) return 'Pay your guest share';
    }
    return 'Pay with Flutterwave';
  }

  function fundAmount(): string {
    if (!escrow) return '';
    let cents = escrow.amount_cents;
    if (escrow.escrow_pattern === 'B' && user?.id) {
      if (user.id === escrow.host_id) cents = escrow.host_share_cents ?? 0;
      else if (user.id === escrow.guest_id) cents = escrow.guest_share_cents ?? 0;
    }
    return formatNGN(cents);
  }

  async function onFund() {
    if (!user?.id || !escrow) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setErrorMsg(null);
    const result = await fundEscrow(escrow, user.id, user.email, () => {
      void queryClient.invalidateQueries({ queryKey: ['escrow', escrowId] });
      showToast('Payment confirmed — escrow updated.');
    });
    if (!result.ok) setErrorMsg(result.error ?? 'Payment could not start');
  }

  async function onConfirmComplete() {
    if (!user?.id || !escrow) return;
    setActionBusy(true);
    const client = createClient();
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
    const client = createClient();
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
    const client = createClient();
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

  if (isLoading) {
    return <p className="text-[14px] font-semibold text-muted">Loading escrow…</p>;
  }

  if (error || !escrow) {
    return (
      <div className="linkup-card px-6 py-10 text-center">
        <p className="font-extrabold text-foreground">Escrow not found</p>
        <Link href="/discover" className="mt-3 inline-block font-extrabold text-primary underline">
          Discover
        </Link>
      </div>
    );
  }

  const planTitle = escrow.plans?.title ?? 'Meetup';
  const pattern = escrow.escrow_pattern as EscrowPattern | null;
  const planStatus = escrow.plans?.status;
  const metadata = escrow.metadata as Record<string, unknown> | null;
  const autoReleased = metadata?.auto_released === true;
  const platformFee = escrow.platform_fee_cents ?? 0;
  const goodwillApplied = escrow.goodwill_applied_cents ?? 0;
  const netRelease = escrow.amount_cents - platformFee;
  const disputed = escrow.status === 'disputed';
  const showWaitingFunded = escrow.status === 'funded' && planStatus === 'active' && !disputed;
  const showReleaseBlock = escrow.status === 'funded' && planStatus === 'completed' && !disputed;
  const isParty = user?.id === escrow.host_id || user?.id === escrow.guest_id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
      <ConfirmDialog
        open={completeOpen}
        title="Mark meetup complete?"
        message="Only confirm if the plan happened as agreed. The other person will be able to request fund release."
        confirmLabel="Yes, we completed it"
        cancelLabel="Cancel"
        busy={actionBusy}
        onClose={() => setCompleteOpen(false)}
        onConfirm={() => void onConfirmComplete()}
      />
      <ConfirmDialog
        open={releaseOpen}
        title="Release funds?"
        message={`This pays out the held amount to the ${pattern === 'C' ? 'host' : 'guest'}. This cannot be undone from the app.`}
        confirmLabel="Release now"
        cancelLabel="Cancel"
        confirmVariant="danger"
        busy={actionBusy}
        onClose={() => setReleaseOpen(false)}
        onConfirm={() => void onConfirmRelease()}
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

      <PlanFlowHeader
        kicker="Secure payment"
        title={planTitle}
        subtitle="Fund through LinkUp escrow — Flutterwave checkout, same as the mobile app."
        backHref="/offers"
      />

      {toastMsg ? (
        <EscrowNoticeBanner tone="success" icon={<IoCheckmarkCircle size={20} />} title={toastMsg} />
      ) : null}
      {errorMsg ? (
        <EscrowNoticeBanner tone="danger" title="Something went wrong">
          {errorMsg}
        </EscrowNoticeBanner>
      ) : null}

      {escrow.plans?.is_group_plan ? (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
          <IoPeople className="text-blue-500" size={15} />
          <span className="text-[11px] font-extrabold text-blue-700">Group Plan</span>
        </div>
      ) : null}

      {escrow.status === 'released' && autoReleased ? (
        <EscrowNoticeBanner
          tone="neutral"
          icon={<IoTimeOutline size={20} />}
          title="Automatically released"
          footer={
            <p className="text-[12px] font-semibold text-muted">
              Released on {formatEscrowDate(escrow.released_at)}
            </p>
          }
        >
          Funds were automatically released 24 hours after plan completion as no dispute was raised.
        </EscrowNoticeBanner>
      ) : null}

      {escrow.status === 'released' && !autoReleased ? (
        <EscrowNoticeBanner
          tone="success"
          icon={<IoCheckmarkCircle size={20} />}
          title="Funds released"
          footer={
            platformFee > 0 ? (
              <p className="text-[12px] font-semibold">Platform fee: {formatNGN(platformFee)}</p>
            ) : undefined
          }
        >
          {getReleaseRecipientLabel(pattern, names.hostName, names.guestName)} —{' '}
          <span className="font-extrabold">{formatNGN(netRelease)}</span> has been added to their wallet.
        </EscrowNoticeBanner>
      ) : null}

      {disputed ? (
        <EscrowNoticeBanner tone="danger" title="Dispute in progress">
          Funds are on hold while our team reviews this case.
        </EscrowNoticeBanner>
      ) : null}

      {escrow.status === 'released' && goodwillApplied > 0 ? (
        <div className="linkup-card space-y-2 p-4">
          <p className="text-[13px] font-extrabold text-foreground">Fee breakdown</p>
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-muted">Platform fee</span>
            <span className="font-semibold text-muted line-through">
              {formatNGN(platformFeeCentsForAmount(escrow.amount_cents))}
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

      <section className="linkup-card relative space-y-4 overflow-hidden p-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/6 to-transparent"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <EscrowStatusBadge status={escrow.status} />
          <p className="font-display text-2xl font-extrabold text-primary">{formatNGN(escrow.amount_cents)}</p>
        </div>

        {escrow.funding_deadline ? (
          <p className="text-[13px] font-semibold text-muted">
            Fund by {formatEscrowDate(escrow.funding_deadline)}
          </p>
        ) : null}

        <EscrowNoticeBanner
          tone="info"
          icon={<IoShieldCheckmark className="text-primary" size={18} />}
          title={`Pattern ${pattern ?? 'A'} escrow`}
        >
          Funds are held until the meetup is confirmed. Activation happens automatically after Flutterwave
          confirms payment.
        </EscrowNoticeBanner>

        {pattern === 'B' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <FundLegCard
              label="Host share"
              amount={formatNGN(escrow.host_share_cents ?? 0)}
              funded={!!escrow.host_funded_at}
            />
            <FundLegCard
              label="Guest share"
              amount={formatNGN(escrow.guest_share_cents ?? 0)}
              funded={!!escrow.guest_funded_at}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {canUserFund() ? (
            <button
              type="button"
              disabled={fundBusy}
              onClick={() => void onFund()}
              className="rounded-full linkup-gradient-primary px-6 py-3 text-[14px] font-extrabold text-white shadow-md disabled:opacity-50"
            >
              {fundBusy ? 'Opening checkout…' : `${fundLabel()} · ${fundAmount()}`}
            </button>
          ) : null}

          {showWaitingFunded && isParty ? (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="rounded-full border border-primary/30 px-6 py-3 text-[14px] font-extrabold text-primary"
            >
              Mark meetup complete
            </button>
          ) : null}

          {showReleaseBlock && isParty ? (
            <button
              type="button"
              onClick={() => setReleaseOpen(true)}
              className="rounded-full bg-[#10B981] px-6 py-3 text-[14px] font-extrabold text-white"
            >
              Release funds
            </button>
          ) : null}

          {(escrow.status === 'funded' || escrow.status === 'active') && isParty && !disputed ? (
            <button
              type="button"
              onClick={() => setDisputeOpen(true)}
              className="rounded-full border border-red-200 px-6 py-3 text-[14px] font-extrabold text-red-700"
            >
              Open dispute
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void onMessage()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 px-5 py-2.5 text-[14px] font-extrabold text-primary"
          >
            <IoChatbubbleEllipsesOutline size={18} />
            Message counterpart
          </button>
        </div>
      </section>
    </div>
  );
}

function FundLegCard({
  label,
  amount,
  funded,
}: {
  label: string;
  amount: string;
  funded: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white/80 px-4 py-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-lg font-extrabold text-foreground">{amount}</p>
      <p className={`text-[12px] font-semibold ${funded ? 'text-emerald-700' : 'text-amber-700'}`}>
        {funded ? 'Funded' : 'Awaiting payment'}
      </p>
    </div>
  );
}

export function EscrowDetailScreen({ escrowId }: { escrowId: string }) {
  return (
    <Suspense fallback={<p className="text-[14px] font-semibold text-muted">Loading…</p>}>
      <EscrowDetailContent escrowId={escrowId} />
    </Suspense>
  );
}
