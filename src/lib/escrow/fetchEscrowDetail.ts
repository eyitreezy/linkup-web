import type { DbEscrowTransaction, DbEscrowDispute, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const PLAN_SELECT_CORE =
  'title, location_label, agreed_location, agreed_scheduled_at, scheduled_at, is_group_plan, is_mood_plan, is_paid, host_contribution_bps, escrow_pattern, status, created_at, updated_at';

const PLAN_SELECT_GROUP_SPLIT = `${PLAN_SELECT_CORE}, host_escrow_id, group_closed_at, total_amount_cents, accepted_guest_amounts_sum_cents, starting_price_cents, agreed_price_cents, budget_min_cents, budget_max_cents`;

export type EscrowDetailPlan = EscrowDetailPlanFields;

export type EscrowDetailPlanFields = {
  title: string;
  location_label: string | null;
  agreed_location?: string | null;
  agreed_scheduled_at?: string | null;
  scheduled_at?: string | null;
  is_group_plan?: boolean | null;
  is_mood_plan?: boolean | null;
  is_paid?: boolean | null;
  host_contribution_bps?: number | null;
  host_escrow_id?: string | null;
  group_closed_at?: string | null;
  escrow_pattern?: string | null;
  total_amount_cents?: number | null;
  accepted_guest_amounts_sum_cents?: number | null;
  starting_price_cents?: number | null;
  agreed_price_cents?: number | null;
  budget_min_cents?: number | null;
  budget_max_cents?: number | null;
  current_suggested_share_cents?: number | null;
  max_guests?: number | null;
  accepted_guest_count?: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type EscrowCounterpartyProfile = {
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

export type EscrowDetailRow = DbEscrowTransaction & {
  plans: EscrowDetailPlan | null;
};

export type EscrowDetailResult = {
  escrow: EscrowDetailRow;
  names: { hostName: string; guestName: string };
  counterparty: EscrowCounterpartyProfile | null;
  dispute: DbEscrowDispute | null;
  guestEscrowRows: DbEscrowTransaction[];
  hostEscrowRow: Pick<
    DbEscrowTransaction,
    'id' | 'status' | 'host_funded_at' | 'host_share_cents' | 'amount_cents' | 'guest_id'
  > | null;
  acceptedOffers: Array<Pick<DbPlanOffer, 'id' | 'bidder_id' | 'current_amount_cents' | 'amount_cents'>>;
  guestProfilesById: Record<string, { display_name: string | null; avatar_url: string | null }>;
};

async function fetchPlanForEscrow(
  client: SupabaseClient,
  planId: string
): Promise<EscrowDetailPlan | null> {
  const full = await client.from('plans').select('*').eq('id', planId).maybeSingle();
  if (!full.error && full.data) {
    return full.data as EscrowDetailPlan;
  }

  const core = await client.from('plans').select(PLAN_SELECT_CORE).eq('id', planId).maybeSingle();
  if (core.error || !core.data) return null;
  return core.data as EscrowDetailPlan;
}

async function resolveGuestEscrowForJoinRequest(
  client: SupabaseClient,
  planId: string,
  joinRequestId: string
): Promise<DbEscrowTransaction | null> {
  const { data: joinReq } = await client
    .from('plan_join_requests')
    .select('requester_id, status, plan_id')
    .eq('id', joinRequestId)
    .maybeSingle();

  if (
    !joinReq ||
    joinReq.status !== 'approved' ||
    joinReq.plan_id !== planId ||
    !joinReq.requester_id
  ) {
    return null;
  }

  const { data: guestRow } = await client
    .from('escrow_transactions')
    .select('*')
    .eq('plan_id', planId)
    .eq('guest_id', joinReq.requester_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (guestRow as DbEscrowTransaction | null) ?? null;
}

/** Load escrow + plan for the secure payment screen (tolerates missing group-split plan columns). */
export async function fetchEscrowDetail(
  client: SupabaseClient,
  escrowId: string,
  viewerUserId?: string,
  opts?: { planId?: string | null; joinRequestId?: string | null }
): Promise<EscrowDetailResult> {
  let { data: row, error } = await client
    .from('escrow_transactions')
    .select('*')
    .eq('id', escrowId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const planId = opts?.planId ?? null;
  const joinRequestId = opts?.joinRequestId ?? null;

  if (!row && planId && joinRequestId) {
    row = await resolveGuestEscrowForJoinRequest(client, planId, joinRequestId);
  }

  // Meetup guest list may pass a join request id in the escrow route segment.
  if (!row && planId) {
    row = await resolveGuestEscrowForJoinRequest(client, planId, escrowId);
  }

  if (!row) throw new Error('Escrow not found');

  const plan = row.plan_id ? await fetchPlanForEscrow(client, row.plan_id) : null;
  const esc = { ...(row as DbEscrowTransaction), plans: plan };

  const partyIds = [esc.host_id, esc.guest_id].filter(Boolean) as string[];
  let names = { hostName: 'Host', guestName: 'Guest' };
  let counterparty: EscrowCounterpartyProfile | null = null;

  if (partyIds.length) {
    const { data: profs } = await client
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .in('user_id', partyIds);

    const map = new Map(
      (profs ?? []).map((p) => [
        p.user_id as string,
        {
          name: (p.display_name as string) ?? 'Member',
          avatarUrl: (p.avatar_url as string | null) ?? null,
          verified: !!(p.verified_badge as boolean | null),
        },
      ])
    );

    if (esc.host_id) {
      const host = map.get(esc.host_id);
      names = { ...names, hostName: host?.name ?? 'Host' };
    }
    if (esc.guest_id) {
      const guest = map.get(esc.guest_id);
      names = { ...names, guestName: guest?.name ?? 'Guest' };
    }

    if (viewerUserId && esc.host_id && esc.guest_id) {
      const cpId = viewerUserId === esc.host_id ? esc.guest_id : esc.host_id;
      const cp = map.get(cpId);
      if (cp) counterparty = cp;
    }
  }

  const [{ data: dRow }, guestEscRes, hostEscRes, offersRes] = await Promise.all([
    client
      .from('escrow_disputes')
      .select('*')
      .eq('escrow_id', esc.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    esc.plan_id && (plan?.is_paid || plan?.is_group_plan || esc.escrow_pattern === 'C')
      ? client
          .from('escrow_transactions')
          .select('*')
          .eq('plan_id', esc.plan_id)
          .not('guest_id', 'is', null)
      : Promise.resolve({ data: [] as DbEscrowTransaction[] }),
    plan?.host_escrow_id
      ? client
          .from('escrow_transactions')
          .select('id, status, host_funded_at, host_share_cents, amount_cents, guest_id')
          .eq('id', plan.host_escrow_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    esc.plan_id && (plan?.is_paid || plan?.is_group_plan || esc.escrow_pattern === 'C')
      ? client
          .from('plan_offers')
          .select('id, bidder_id, current_amount_cents, amount_cents')
          .eq('plan_id', esc.plan_id)
          .eq('status', 'accepted')
      : Promise.resolve({ data: [] }),
  ]);

  const guestEscrowRows = (guestEscRes.data ?? []) as DbEscrowTransaction[];
  const acceptedOffers = (offersRes.data ?? []) as EscrowDetailResult['acceptedOffers'];
  const profileIds = new Set<string>();
  for (const row of guestEscrowRows) {
    if (row.guest_id) profileIds.add(row.guest_id);
  }
  for (const offer of acceptedOffers) {
    if (offer.bidder_id) profileIds.add(offer.bidder_id);
  }
  let guestProfilesById: EscrowDetailResult['guestProfilesById'] = {};
  if (profileIds.size > 0) {
    const { data: guestProfs } = await client
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', [...profileIds]);
    guestProfilesById = Object.fromEntries(
      (guestProfs ?? []).map((p) => [
        p.user_id as string,
        {
          display_name: (p.display_name as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
        },
      ])
    );
  }

  return {
    escrow: esc,
    names,
    counterparty,
    dispute: (dRow as DbEscrowDispute | null) ?? null,
    guestEscrowRows,
    hostEscrowRow: (hostEscRes.data as EscrowDetailResult['hostEscrowRow']) ?? null,
    acceptedOffers,
    guestProfilesById,
  };
}
