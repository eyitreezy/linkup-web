'use client';

import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { resolveEscrowHref } from '@/lib/plans/planAgreementRoute';
import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import {
  isEscrowFullyFundedForMeet,
  isSplitEscrowPartiallyFunded,
  isSplitEscrowPattern,
} from '@/lib/escrow/splitEscrowFunding';
import { createClient } from '@/lib/supabase/client';
import { useEscrowRealtime } from '@/hooks/useEscrowRealtime';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoArrowForward, IoCheckmarkCircle, IoTimeOutline } from 'react-icons/io5';

type Props = {
  plan: DbPlan;
  offer: DbPlanOffer;
  currentUserId: string;
};

export function PlanEscrowPaymentCard({ plan, offer, currentUserId }: Props) {
  const [escrow, setEscrow] = useState<DbEscrowTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isGroupSplitPlan(plan) || plan.is_group_plan || !plan.is_paid) {
      setLoading(false);
      return;
    }
    const client = createClient();
    const { data: byGuest } = await client
      .from('escrow_transactions')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('guest_id', offer.bidder_id)
      .maybeSingle();

    let row = byGuest as DbEscrowTransaction | null;
    if (!row) {
      const { data: byPlan } = await client
        .from('escrow_transactions')
        .select('*')
        .eq('plan_id', plan.id)
        .maybeSingle();
      row = byPlan ? (byPlan as DbEscrowTransaction) : null;
    }
    setEscrow(row);
    setLoading(false);
  }, [plan.id, plan.is_group_plan, plan.is_paid, offer.bidder_id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEscrowRealtime(
    escrow?.id ?? '',
    useCallback(
      (next) => {
        setEscrow(next);
      },
      []
    )
  );

  if (isGroupSplitPlan(plan) || plan.is_group_plan || !plan.is_paid) return null;

  const fundingUi = escrow ? getEscrowFundingUiState(escrow, currentUserId) : null;
  const isSplit = isSplitEscrowPattern(plan.escrow_pattern);
  const fullyFunded = escrow ? isEscrowFullyFundedForMeet(escrow) : false;
  const partiallyFunded = escrow ? isSplitEscrowPartiallyFunded(escrow) : false;
  const showCta = escrow?.id && !fullyFunded && (fundingUi?.canFund || escrow.status === 'pending_funding');

  let ctaLabel = 'Open secure payment';
  if (fundingUi?.canFund) {
    ctaLabel = fundingUi.fundCtaTitle;
  } else if (escrow?.status === 'pending_funding') {
    ctaLabel = 'View payment status';
  }

  return (
    <section className="linkup-card relative space-y-3 overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/10 to-transparent" />
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Secure payment</p>
      <h3 className="font-display text-lg font-extrabold text-foreground">
        {isSplit ? 'Split escrow' : 'Escrow setup'}
      </h3>

      {loading ? (
        <p className="text-[14px] font-semibold text-muted">Loading escrow…</p>
      ) : escrow ? (
        <div className="space-y-2">
          <EscrowStatusBadge status={escrow.status} />
          {fundingUi?.canFund && fundingUi.payAmountCents > 0 ? (
            <p className="text-[14px] font-bold text-foreground">
              Your payment: {formatNGN(fundingUi.payAmountCents)}
            </p>
          ) : null}
          {isSplit ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 px-3 py-2">
                <p className="text-[11px] font-extrabold uppercase text-muted">Host share</p>
                <p className="font-extrabold">{formatNGN(escrow.host_share_cents ?? 0)}</p>
                <p className={`text-[12px] font-semibold ${escrow.host_funded_at ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {escrow.host_funded_at ? 'Funded' : 'Pending'}
                </p>
              </div>
              <div className="rounded-xl border border-border/80 px-3 py-2">
                <p className="text-[11px] font-extrabold uppercase text-muted">Guest share</p>
                <p className="font-extrabold">{formatNGN(escrow.guest_share_cents ?? 0)}</p>
                <p className={`text-[12px] font-semibold ${escrow.guest_funded_at ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {escrow.guest_funded_at ? 'Funded' : 'Pending'}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] font-semibold text-muted">
          Tap below to open the payment screen and fund escrow.
        </p>
      )}

      {fullyFunded ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <IoCheckmarkCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} />
          <p className="text-[13px] font-semibold text-emerald-800">
            {isSplit ? 'Both shares funded. Your plan is now active.' : 'Escrow funded. Your plan is now active.'}
          </p>
        </div>
      ) : partiallyFunded ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <IoTimeOutline className="mt-0.5 shrink-0 text-amber-600" size={18} />
          <p className="text-[13px] font-semibold text-amber-800">
            {fundingUi?.waitingForCounterparty
              ? fundingUi.waitingSubtitle ??
                "You've paid your share. Waiting for the other person to fund theirs."
              : 'One share funded. Both parties must pay before the meetup is confirmed.'}
          </p>
        </div>
      ) : null}

      {showCta && escrow?.id ? (
        <Link
          href={resolveEscrowHref(escrow.id, { planId: plan.id, offerId: offer.id })}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full linkup-gradient-primary px-5 py-3 text-[14px] font-extrabold text-white"
        >
          {ctaLabel}
          <IoArrowForward size={16} />
        </Link>
      ) : null}

      {isSplit && !fullyFunded ? (
        <p className="text-center text-[12px] font-semibold text-muted">
          The meetup will be confirmed once both parties have funded their share.
        </p>
      ) : null}
    </section>
  );
}
