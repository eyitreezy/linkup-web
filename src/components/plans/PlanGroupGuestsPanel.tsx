'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TierBadge } from '@/components/subscription/TierBadge';
import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import {
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
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircle,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
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
  onMessageGroup?: () => void;
  messageGroupBusy?: boolean;
};

function joinRequestSlotCents(plan: DbPlan): number {
  if (plan.is_group_plan) {
    return plan.current_suggested_share_cents ?? plan.agreed_price_cents ?? plan.starting_price_cents ?? 0;
  }
  return plan.agreed_price_cents ?? plan.starting_price_cents ?? 0;
}

export function PlanGroupGuestsPanel({
  plan,
  hostUserId,
  currentUserId,
  seedAcceptedOffers,
  offersReady = false,
  refreshKey,
  onMessageGroup,
  messageGroupBusy = false,
}: Props) {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    if (!plan.is_group_plan) {
      setLoading(false);
      return;
    }

    if (rowsRef.current.length === 0) setLoading(true);

    let accepted: DbPlanOffer[];

    if (plan.is_negotiable === false) {
      const client = createClient();
      const { data: joinRows } = await client
        .from('plan_join_requests')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('status', 'approved');
      const joinRequests = joinRows ?? [];
      const cents = joinRequestSlotCents(plan);
      accepted = joinRequests.map((row) => ({
        id: row.id as string,
        plan_id: plan.id,
        bidder_id: row.requester_id as string,
        amount_cents: cents,
        current_amount_cents: cents,
        message: (row.message as string | null) ?? null,
        status: 'accepted' as const,
        round: 1,
        expires_at: null,
        proposed_scheduled_at: plan.scheduled_at ?? null,
        proposed_location: null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      }));
    } else if (seedAcceptedOffers && offersReady) {
      accepted = seedAcceptedOffers;
    } else {
      const client = createClient();
      const { data: offers } = await client
        .from('plan_offers')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('status', 'accepted');
      accepted = (offers ?? []) as DbPlanOffer[];
    }

    if (accepted.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const client = createClient();
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
          'id, plan_id, host_id, payer_id, guest_id, status, escrow_pattern, host_funded_at, guest_funded_at, metadata'
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
        const esc = findGuestEscrowForJoinRequestOffer(escrowList, offer.bidder_id, offer.id);
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

  if (!plan.is_group_plan || currentUserId !== hostUserId) return null;

  const { maxGuests, freeCap, acceptedCount, freeUsed, premiumUsed } = resolveGroupGuestSlotCounts(
    plan,
    rows,
    seedAcceptedOffers?.length ?? 0
  );

  const footerHref =
    plan.is_negotiable === false ? `/plan/${plan.id}/requests` : `/plan/${plan.id}/negotiate`;
  const footerLabel = plan.is_negotiable === false ? 'Manage requests →' : 'View all offers →';

  return (
    <section className="linkup-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-extrabold text-foreground">
            Guests ({acceptedCount} / {maxGuests} accepted)
          </h3>
          {onMessageGroup ? (
            <button
              type="button"
              onClick={onMessageGroup}
              disabled={messageGroupBusy}
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[12px] font-extrabold text-foreground shadow-sm transition hover:bg-[#F8F7FF] disabled:opacity-50"
            >
              <IoChatbubbleEllipsesOutline size={16} aria-hidden />
              {messageGroupBusy ? 'Opening…' : 'Message group'}
            </button>
          ) : null}
        </div>
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
                    })}
                    className="inline-flex min-w-[4.75rem] items-center justify-center gap-1 rounded-full linkup-gradient-primary px-2.5 py-2 text-[12px] font-extrabold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"
                    aria-label={`Open ${guest.profile?.display_name ?? 'guest'} escrow`}
                  >
                    <IoShieldCheckmarkOutline size={14} aria-hidden />
                    Escrow
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border/50 px-5 py-3">
        <Link href={footerHref} className="text-[13px] font-extrabold text-primary hover:underline">
          {footerLabel}
        </Link>
      </div>
    </section>
  );
}
