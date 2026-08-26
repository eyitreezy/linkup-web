'use client';

import { GroupGuestRemoveModal } from '@/components/plans/GroupGuestRemoveModal';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TierBadge } from '@/components/subscription/TierBadge';
import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import {
  findGuestEscrowForBidder,
  findGuestEscrowForJoinRequestOffer,
  guestEscrowStatusLabel,
  isGuestEscrowFunded,
} from '@/lib/plans/groupGuestEscrowDisplay';
import { resolveGroupGuestSlotCounts } from '@/lib/plans/groupGuestSlotCounts';
import { resolveEscrowHref } from '@/lib/plans/planAgreementRoute';
import { createClient } from '@/lib/supabase/client';
import type { DbPlan, DbPlanOffer, DbProfile, SubscriptionTierDb } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IoCheckmarkCircle,
  IoCloseCircleOutline,
  IoDocumentTextOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoWalletOutline,
} from 'react-icons/io5';

type GuestRow = {
  offer: DbPlanOffer;
  profile: Pick<DbProfile, 'display_name' | 'avatar_url' | 'primary_photo_url' | 'photo_urls'> | null;
  subscription_tier: SubscriptionTierDb;
  escrow_id: string | null;
  funded: boolean;
  statusLabel: string;
};

type Props = {
  plan: DbPlan;
  hostUserId: string;
  currentUserId?: string;
  /** When parent already loaded offers, skip the initial offers query. */
  seedAcceptedOffers?: DbPlanOffer[];
  offersReady?: boolean;
  /** Bumps when parent realtime refreshes offers / plan (escrow, accepts). */
  refreshKey?: string;
  guestsHeaderAction?: {
    show: boolean;
    kind: 'pay_share' | 'confirm_plan';
    amountLabel?: string | null;
    onClick: () => void;
  };
};

const cardHeaderPrimaryBtn =
  'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50';

function joinRequestSlotCents(plan: DbPlan): number {
  if (plan.is_group_plan) {
    return plan.current_suggested_share_cents ?? plan.agreed_price_cents ?? plan.starting_price_cents ?? 0;
  }
  return plan.agreed_price_cents ?? plan.starting_price_cents ?? 0;
}

function syntheticOfferFromJoinRequest(
  plan: DbPlan,
  row: Record<string, unknown>
): DbPlanOffer {
  const cents = joinRequestSlotCents(plan);
  return {
    id: row.id as string,
    plan_id: plan.id,
    bidder_id: row.requester_id as string,
    amount_cents: cents,
    current_amount_cents: cents,
    message: (row.message as string | null) ?? null,
    status: 'accepted',
    round: 1,
    expires_at: null,
    proposed_scheduled_at: plan.scheduled_at ?? null,
    proposed_location: null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function syntheticOfferFromInvitation(
  plan: DbPlan,
  row: Record<string, unknown>
): DbPlanOffer {
  const cents = joinRequestSlotCents(plan);
  return {
    id: `invitation-${row.id as string}`,
    plan_id: plan.id,
    bidder_id: row.invitee_user_id as string,
    amount_cents: cents,
    current_amount_cents: cents,
    message: null,
    status: 'accepted',
    round: 1,
    expires_at: null,
    proposed_scheduled_at: plan.scheduled_at ?? null,
    proposed_location: null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mergeAcceptedGuestOffers(
  plan: DbPlan,
  joinRequests: Record<string, unknown>[],
  invitations: Record<string, unknown>[],
  offers: DbPlanOffer[]
): DbPlanOffer[] {
  const byUserId = new Map<string, DbPlanOffer>();

  for (const row of joinRequests) {
    const bidderId = row.requester_id as string;
    byUserId.set(bidderId, syntheticOfferFromJoinRequest(plan, row));
  }

  for (const row of invitations) {
    const bidderId = row.invitee_user_id as string | null;
    if (!bidderId || byUserId.has(bidderId)) continue;
    byUserId.set(bidderId, syntheticOfferFromInvitation(plan, row));
  }

  for (const offer of offers) {
    if (!byUserId.has(offer.bidder_id)) {
      byUserId.set(offer.bidder_id, offer);
    }
  }

  return Array.from(byUserId.values());
}

export function PlanGroupGuestsPanel({
  plan,
  hostUserId,
  currentUserId,
  seedAcceptedOffers,
  offersReady = false,
  refreshKey,
  guestsHeaderAction,
}: Props) {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<GuestRow | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    if (!plan.is_group_plan) {
      setLoading(false);
      return;
    }

    if (rowsRef.current.length === 0) setLoading(true);

    let accepted: DbPlanOffer[];

    const client = createClient();

    if (plan.is_negotiable === false) {
      const [{ data: joinRows }, { data: inviteRows }] = await Promise.all([
        client
          .from('plan_join_requests')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('status', 'approved'),
        client
          .from('plan_invitations')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('status', 'accepted')
          .not('invitee_user_id', 'is', null),
      ]);
      accepted = mergeAcceptedGuestOffers(plan, joinRows ?? [], inviteRows ?? [], []);
    } else if (seedAcceptedOffers && offersReady) {
      const { data: inviteRows } = await client
        .from('plan_invitations')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('status', 'accepted')
        .not('invitee_user_id', 'is', null);
      accepted = mergeAcceptedGuestOffers(plan, [], inviteRows ?? [], seedAcceptedOffers);
    } else {
      const [{ data: offers }, { data: inviteRows }] = await Promise.all([
        client.from('plan_offers').select('*').eq('plan_id', plan.id).eq('status', 'accepted'),
        client
          .from('plan_invitations')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('status', 'accepted')
          .not('invitee_user_id', 'is', null),
      ]);
      accepted = mergeAcceptedGuestOffers(plan, [], inviteRows ?? [], (offers ?? []) as DbPlanOffer[]);
    }

    if (accepted.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const bidderIds = accepted.map((o) => o.bidder_id);
    const [{ data: profiles }, { data: users }, { data: escrows }] = await Promise.all([
      client
        .from('profiles')
        .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls')
        .in('user_id', bidderIds),
      client.from('users').select('id, subscription_tier').in('id', bidderIds),
      client
        .from('escrow_transactions')
        .select(
          'id, plan_id, host_id, payer_id, guest_id, status, escrow_pattern, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents, metadata'
        )
        .eq('plan_id', plan.id)
        .not('guest_id', 'is', null),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const userMap = new Map((users ?? []).map((u) => [u.id as string, u]));
    const escrowList = escrows ?? [];

    setRows(
      accepted.map((offer) => {
        const prof = profMap.get(offer.bidder_id);
        const u = userMap.get(offer.bidder_id);
        const esc = offer.id.startsWith('invitation-')
          ? findGuestEscrowForBidder(escrowList, offer.bidder_id)
          : findGuestEscrowForJoinRequestOffer(escrowList, offer.bidder_id, offer.id);
        const funded = isGuestEscrowFunded(esc ?? null, offer.bidder_id);
        return {
          offer,
          profile: prof
            ? {
                display_name: (prof.display_name as string) ?? null,
                avatar_url: (prof.avatar_url as string) ?? null,
                primary_photo_url: (prof.primary_photo_url as string) ?? null,
                photo_urls: (prof.photo_urls as string[]) ?? null,
              }
            : null,
          subscription_tier: (u?.subscription_tier as SubscriptionTierDb) ?? 'FREE',
          escrow_id: (esc?.id as string) ?? null,
          funded,
          statusLabel: guestEscrowStatusLabel(esc ?? null, offer.bidder_id, !!plan.is_paid),
        };
      })
    );
    setLoading(false);
  }, [
    plan.id,
    plan.is_group_plan,
    plan.is_negotiable,
    plan.is_paid,
    plan.accepted_guest_count,
    plan.max_guests,
    plan.max_free_guests,
    plan.current_suggested_share_cents,
    plan.agreed_price_cents,
    plan.starting_price_cents,
    plan.scheduled_at,
    offersReady,
    refreshKey,
    seedAcceptedOffers?.length,
    seedAcceptedOffers?.map((o) => `${o.id}:${o.status}:${o.current_amount_cents ?? o.amount_cents}`).join(','),
  ]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!plan.is_group_plan) return;
    return subscribeEscrowRealtime({
      planId: plan.id,
      onRefresh: () => {
        void loadRef.current();
      },
    });
  }, [plan.id, plan.is_group_plan]);

  useEffect(() => {
    if (!plan.is_group_plan) return;
    return subscribePostgresRealtime(
      () => {
        void loadRef.current();
      },
      { table: 'plan_offers', filter: `plan_id=eq.${plan.id}` },
      { channelPrefix: 'plan-guests-rt' }
    );
  }, [plan.id, plan.is_group_plan]);

  useEffect(() => {
    if (!plan.is_group_plan || plan.is_negotiable !== false) return;
    return subscribePostgresRealtime(
      () => {
        void loadRef.current();
      },
      { table: 'plan_join_requests', filter: `plan_id=eq.${plan.id}` },
      { channelPrefix: 'plan-guests-join-rt' }
    );
  }, [plan.id, plan.is_group_plan, plan.is_negotiable]);

  useEffect(() => {
    if (!plan.is_group_plan) return;
    return subscribePostgresRealtime(
      () => {
        void loadRef.current();
      },
      { table: 'plan_invitations', filter: `plan_id=eq.${plan.id}` },
      { channelPrefix: 'plan-guests-invite-rt' }
    );
  }, [plan.id, plan.is_group_plan]);

  if (!plan.is_group_plan || currentUserId !== hostUserId) return null;

  const { maxGuests, freeCap, acceptedCount, freeUsed, premiumUsed } = resolveGroupGuestSlotCounts(
    plan,
    rows,
    seedAcceptedOffers?.length ?? 0
  );

  const footerHref = `/plan/${plan.id}/negotiate`;
  const footerLabel = 'View all offers →';

  return (
    <section className="linkup-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-extrabold text-foreground">
              Guests ({acceptedCount} / {maxGuests} accepted)
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-muted">
              {acceptedCount} of {maxGuests} guest slots used
              {freeCap > 0 ? (
                <>
                  {' '}
                  · {freeUsed} of {freeCap} free-tier
                  {premiumUsed > 0 ? ` · ${premiumUsed} premium` : ''}
                </>
              ) : null}
            </p>
          </div>
          {guestsHeaderAction?.show ? (
            <button type="button" className={cardHeaderPrimaryBtn} onClick={guestsHeaderAction.onClick}>
              {guestsHeaderAction.kind === 'pay_share' ? (
                <>
                  <IoWalletOutline size={18} aria-hidden />
                  Pay your share
                  {guestsHeaderAction.amountLabel ? ` · ${guestsHeaderAction.amountLabel}` : ''}
                </>
              ) : (
                <>
                  <IoDocumentTextOutline size={18} aria-hidden />
                  Confirm plan
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
      {loading ? (
        <p className="px-5 py-6 text-center text-[13px] font-semibold text-muted">Loading guests…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] font-semibold text-muted">No accepted guests yet.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((guest) => (
            <li key={guest.offer.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar
                  profile={guest.profile}
                  displayName={guest.profile?.display_name}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-extrabold text-foreground">
                    {guest.profile?.display_name ?? 'Guest'}
                  </p>
                  <TierBadge
                    tier={(guest.subscription_tier as 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM') ?? 'FREE'}
                    size="sm"
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex max-w-[6rem] items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold ${
                    guest.funded
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {guest.funded ? (
                    <IoCheckmarkCircle size={13} className="shrink-0" />
                  ) : (
                    <IoTimeOutline size={13} className="shrink-0" />
                  )}
                  <span className="truncate">{guest.statusLabel}</span>
                </span>
                {guest.escrow_id ? (
                  <Link
                    href={resolveEscrowHref(guest.escrow_id, {
                      planId: plan.id,
                      offerId: guest.offer.id,
                      source: 'plan',
                    })}
                    className="inline-flex min-w-[4.75rem] items-center justify-center gap-1 rounded-full linkup-gradient-primary px-2.5 py-2 text-[12px] font-extrabold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"
                    aria-label={`Open ${guest.profile?.display_name ?? 'guest'} escrow`}
                  >
                    <IoShieldCheckmarkOutline size={14} aria-hidden />
                    Escrow
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setRemoveTarget(guest)}
                  className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full border border-[#EF4444]/30 px-2.5 py-2 text-[12px] font-extrabold text-[#EF4444] transition hover:bg-[#EF4444]/5"
                  aria-label={`Remove ${guest.profile?.display_name ?? 'guest'}`}
                >
                  <IoCloseCircleOutline size={14} aria-hidden />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {removeTarget ? (
        <GroupGuestRemoveModal
          planId={plan.id}
          guestUserId={removeTarget.offer.bidder_id}
          guestName={removeTarget.profile?.display_name ?? 'Guest'}
          guestFunded={removeTarget.funded}
          onDismiss={() => setRemoveTarget(null)}
          onRemoved={() => {
            setRemoveTarget(null);
            void loadRef.current();
          }}
        />
      ) : null}
      {plan.is_negotiable !== false ? (
        <div className="border-t border-border/50 px-5 py-3">
          <Link href={footerHref} className="text-[13px] font-extrabold text-primary hover:underline">
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
