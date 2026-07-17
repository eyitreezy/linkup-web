import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import { fetchPlanById } from '@/services/plans.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';

export type AgreementProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_badge: boolean | null;
};

export type AgreementEscrowRow = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'guest_id'
  | 'amount_cents'
  | 'status'
  | 'escrow_pattern'
  | 'plan_id'
  | 'host_id'
  | 'payer_id'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'funding_deadline'
>;

export type PlanAgreementBundle = {
  plan: DbPlan;
  offer: DbPlanOffer;
  hostProfile: AgreementProfile | null;
  guestProfile: AgreementProfile | null;
  confirmationUserIds: string[];
  escrowId: string | null;
  escrowCents: number | null;
  mutualVoteIds: string[];
  counterpartyKycTier: number | null;
  myEscrow?: AgreementEscrowRow | null;
  hostEscrow?: AgreementEscrowRow | null;
  acceptedOffers?: DbPlanOffer[];
  guestEscrows?: AgreementEscrowRow[];
  guestSlotProfiles?: AgreementProfile[];
};

async function resolveAgreementOffer(
  client: SupabaseClient,
  plan: DbPlan,
  opts?: { offerId?: string | null; userId?: string | null }
): Promise<DbPlanOffer | null> {
  if (opts?.offerId) {
    const { data } = await client.from('plan_offers').select('*').eq('id', opts.offerId).maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  if (plan.accepted_offer_id) {
    const { data } = await client
      .from('plan_offers')
      .select('*')
      .eq('id', plan.accepted_offer_id)
      .maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  if (opts?.userId) {
    const { data } = await client
      .from('plan_offers')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('bidder_id', opts.userId)
      .eq('status', 'accepted')
      .maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  if (opts?.userId === plan.creator_id && isGroupSplitPlan(plan)) {
    const { data } = await client
      .from('plan_offers')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  return null;
}

export async function fetchPlanAgreementBundle(
  client: SupabaseClient,
  planId: string,
  opts?: { offerId?: string | null; userId?: string | null }
): Promise<{ data: PlanAgreementBundle | null; error: string | null }> {
  const { data: plan, error } = await fetchPlanById(client, planId);
  if (error) return { data: null, error: error.message };
  if (!plan) return { data: null, error: 'Plan not found' };
  const planRow = plan;

  const offer = await resolveAgreementOffer(client, planRow, opts);
  if (!offer || offer.status !== 'accepted') {
    return { data: null, error: 'No accepted offer for this plan' };
  }

  const isParty = opts?.userId === planRow.creator_id || opts?.userId === offer.bidder_id;
  if (opts?.userId && !isParty) {
    return { data: null, error: 'No access to this agreement' };
  }

  const bidderId = offer.bidder_id;
  const escrowGuestId = offer.bidder_id;
  const paymentRequired =
    (planRow.agreed_price_cents ?? offer.amount_cents ?? planRow.starting_price_cents ?? 0) > 0;

  const groupSplit = isGroupSplitPlan(planRow);
  const isHostViewer = opts?.userId === planRow.creator_id;
  const escrowSelect =
    'id, guest_id, amount_cents, status, escrow_pattern, plan_id, host_id, payer_id, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents, funding_deadline';

  async function fetchViewerEscrow(): Promise<AgreementEscrowRow | null> {
    if (!paymentRequired || !opts?.userId) return null;

    if (groupSplit && isHostViewer) {
      if (planRow.host_escrow_id) {
        const { data } = await client
          .from('escrow_transactions')
          .select(escrowSelect)
          .eq('id', planRow.host_escrow_id)
          .maybeSingle();
        if (data) return data as AgreementEscrowRow;
      }
      const { data: hostRow } = await client
        .from('escrow_transactions')
        .select(escrowSelect)
        .eq('plan_id', planId)
        .eq('payer_id', planRow.creator_id)
        .maybeSingle();
      if (hostRow) return hostRow as AgreementEscrowRow;
      // Host in group-split should never fall back to a guest slot escrow row.
      return null;
    }

    if (escrowGuestId) {
      const { data: byGuest } = await client
        .from('escrow_transactions')
        .select(escrowSelect)
        .eq('plan_id', planId)
        .eq('guest_id', escrowGuestId)
        .maybeSingle();
      if (byGuest) return byGuest as AgreementEscrowRow;
    }

    const { data: byPayer } = await client
      .from('escrow_transactions')
      .select(escrowSelect)
      .eq('plan_id', planId)
      .eq('payer_id', opts.userId)
      .maybeSingle();
    return (byPayer as AgreementEscrowRow | null) ?? null;
  }

  const groupSplitQueries = groupSplit
    ? Promise.all([
        client.from('plan_offers').select('*').eq('plan_id', planId).eq('status', 'accepted'),
        client.from('escrow_transactions').select(escrowSelect).eq('plan_id', planId),
        planRow.host_escrow_id
          ? client.from('escrow_transactions').select(escrowSelect).eq('id', planRow.host_escrow_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : Promise.resolve([{ data: [] }, { data: [] }, { data: null }] as const);

  const [
    { data: hostProfile },
    { data: guestProfile },
    { data: confirmations },
    { data: guestUser },
    { data: mutualVotes },
    viewerEscrow,
    groupSplitResult,
  ] = await Promise.all([
    client
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .eq('user_id', planRow.creator_id)
      .maybeSingle(),
    client
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .eq('user_id', bidderId)
      .maybeSingle(),
    client.from('agreement_confirmations').select('user_id').eq('plan_id', planId),
    client.from('users').select('kyc_tier').eq('id', bidderId).maybeSingle(),
    client.from('mutual_plan_cancel_votes').select('user_id').eq('plan_id', planId),
    fetchViewerEscrow(),
    groupSplitQueries,
  ]);

  const [acceptedOffersRes, guestEscrowsRes, hostEscrowRes] = groupSplitResult;
  const acceptedOffers = (acceptedOffersRes.data ?? []) as DbPlanOffer[];
  const guestEscrows = (guestEscrowsRes.data ?? []) as AgreementEscrowRow[];
  const hostEscrow = (hostEscrowRes.data as AgreementEscrowRow | null) ?? null;
  const myEscrow = (viewerEscrow as AgreementEscrowRow | null) ?? null;
  const escrow = myEscrow;

  let guestSlotProfiles: AgreementProfile[] | undefined;
  if (groupSplit && acceptedOffers.length > 0) {
    const bidderIds = acceptedOffers.map((o) => o.bidder_id);
    const { data: slotProfiles } = await client
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .in('user_id', bidderIds);
    guestSlotProfiles = (slotProfiles ?? []) as AgreementProfile[];
  }

  return {
    data: {
      plan: planRow,
      offer,
      hostProfile: (hostProfile as AgreementProfile | null) ?? null,
      guestProfile: (guestProfile as AgreementProfile | null) ?? null,
      confirmationUserIds: (confirmations ?? []).map((c) => c.user_id as string),
      escrowId: (escrow?.id as string | undefined) ?? null,
      escrowCents: (escrow?.amount_cents as number | undefined) ?? null,
      mutualVoteIds: (mutualVotes ?? []).map((r) => r.user_id as string),
      counterpartyKycTier: (guestUser?.kyc_tier as number | undefined) ?? null,
      myEscrow,
      ...(groupSplit
        ? {
            hostEscrow,
            acceptedOffers,
            guestEscrows,
            guestSlotProfiles,
          }
        : {}),
    },
    error: null,
  };
}
