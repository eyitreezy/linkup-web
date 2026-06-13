'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TierBadge } from '@/components/subscription/TierBadge';
import { createClient } from '@/lib/supabase/client';
import type {
  DbPlan,
  DbPlanOffer,
  DbProfile,
  EscrowStatus,
  SubscriptionTierDb,
} from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type GuestRow = {
  offer: DbPlanOffer;
  profile: Pick<DbProfile, 'display_name' | 'avatar_url' | 'primary_photo_url' | 'photo_urls'> | null;
  subscription_tier: SubscriptionTierDb;
  escrow_status: EscrowStatus | null;
  escrow_id: string | null;
};

type Props = {
  plan: DbPlan;
  hostUserId: string;
  currentUserId?: string;
};

export function PlanGroupGuestsPanel({ plan, hostUserId, currentUserId }: Props) {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!plan.is_group_plan) {
      setLoading(false);
      return;
    }
    const client = createClient();
    const { data: offers } = await client
      .from('plan_offers')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('status', 'accepted');

    const accepted = (offers ?? []) as DbPlanOffer[];
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
      client.from('escrow_transactions').select('id, plan_id, payer_id, status').eq('plan_id', plan.id),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const userMap = new Map((users ?? []).map((u) => [u.id as string, u]));

    setRows(
      accepted.map((offer) => {
        const prof = profMap.get(offer.bidder_id);
        const u = userMap.get(offer.bidder_id);
        const esc = (escrows ?? []).find((e) => e.payer_id === offer.bidder_id);
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
          escrow_status: (esc?.status as EscrowStatus) ?? null,
          escrow_id: (esc?.id as string) ?? null,
        };
      })
    );
    setLoading(false);
  }, [plan.id, plan.is_group_plan]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!plan.is_group_plan || currentUserId !== hostUserId) return null;

  const maxGuests = plan.max_guests ?? plan.max_free_guests ?? 5;
  const freeCap = plan.max_free_guests ?? 5;
  const freeUsed = rows.filter((r) => r.subscription_tier === 'FREE').length;

  return (
    <section className="linkup-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-extrabold text-foreground">
            Guests ({rows.length} / {maxGuests} accepted)
          </h3>
          <Link
            href={`/plan/${plan.id}/negotiate`}
            className="text-[12px] font-extrabold text-primary underline"
          >
            View all offers →
          </Link>
        </div>
        <p className="mt-1 text-[12px] font-semibold text-muted">
          {freeUsed} of {freeCap} free guest slots used
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
                {guest.escrow_status ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold capitalize text-primary">
                    {guest.escrow_status.replace(/_/g, ' ')}
                  </span>
                ) : null}
                {guest.escrow_id ? (
                  <Link
                    href={`/escrow/${guest.escrow_id}`}
                    className="text-[11px] font-extrabold text-muted underline hover:text-primary"
                  >
                    Escrow →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
