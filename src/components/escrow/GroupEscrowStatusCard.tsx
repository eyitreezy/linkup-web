'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { TierBadge } from '@/components/subscription/TierBadge';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { DbEscrowTransaction } from '@/types/database';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoCheckmarkCircle, IoChevronForward, IoPeople } from 'react-icons/io5';

type GuestRow = {
  escrow: DbEscrowTransaction;
  displayName: string;
  avatarUrl: string | null;
  tier: SubscriptionTier | null;
};

type Props = {
  planId: string;
  isGroupPlan: boolean;
  isHost: boolean;
};

function isFunded(status: string): boolean {
  return status === 'funded' || status === 'active' || status === 'released';
}

export function GroupEscrowStatusCard({ planId, isGroupPlan, isHost }: Props) {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isGroupPlan) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = createClient();
    const { data: escrows } = await client
      .from('escrow_transactions')
      .select('*')
      .eq('plan_id', planId)
      .order('group_plan_index', { ascending: true });

    const guestIds = (escrows ?? []).map((e) => e.guest_id).filter(Boolean) as string[];
    if (!guestIds.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: users }] = await Promise.all([
      client.from('profiles').select('user_id, display_name, avatar_url').in('user_id', guestIds),
      client.from('users').select('id, subscription_tier').in('id', guestIds),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const tierMap = new Map(
      (users ?? []).map((u) => [u.id as string, u.subscription_tier as SubscriptionTier])
    );

    setRows(
      (escrows ?? []).map((e) => {
        const guestId = e.guest_id as string;
        const prof = profMap.get(guestId);
        return {
          escrow: e as DbEscrowTransaction,
          displayName: prof?.display_name ?? 'Guest',
          avatarUrl: (prof?.avatar_url as string | null) ?? null,
          tier: tierMap.get(guestId) ?? null,
        };
      })
    );
    setLoading(false);
  }, [isGroupPlan, planId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isGroupPlan) return null;

  const fundedCount = rows.filter((r) => isFunded(r.escrow.status)).length;
  const total = rows.length;
  const progress = total > 0 ? fundedCount / total : 0;
  const allFunded = total > 0 && fundedCount === total;

  return (
    <section className="linkup-card relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/8 to-transparent"
        aria-hidden
      />

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDE8FF] text-primary">
              <IoPeople size={20} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Group escrow</p>
              <h3 className="font-display text-lg font-extrabold text-foreground">Guest funding progress</h3>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary">
            {fundedCount}/{total} funded
          </span>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
            <span className="text-muted">Overall progress</span>
            <span className={cn('font-extrabold', allFunded ? 'text-emerald-600' : 'text-primary')}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-border bg-white">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                allFunded ? 'bg-emerald-500' : 'linkup-gradient-primary'
              )}
              style={{ width: `${Math.max(progress * 100, total > 0 ? 6 : 0)}%` }}
            />
          </div>
        </div>

        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-[#EDE8FF]/50" />
        ) : rows.length === 0 ? (
          <p className="text-[13px] font-semibold text-muted">No guest escrows yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ escrow, displayName, avatarUrl, tier }) => {
              const funded = isFunded(escrow.status);
              return (
                <li key={escrow.id}>
                  <Link
                    href={`/escrow/${escrow.id}`}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:border-primary/25',
                      funded
                        ? 'border-emerald-200/80 bg-emerald-50/40'
                        : 'border-border bg-white/80'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <AvatarWithPresence
                          uri={avatarUrl}
                          name={displayName}
                          size={40}
                          presence={null}
                          showDot={false}
                        />
                        {funded ? (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <IoCheckmarkCircle size={12} />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-extrabold text-foreground">{displayName}</p>
                        {tier ? <TierBadge tier={tier} size="sm" /> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <EscrowStatusBadge status={escrow.status} />
                      <IoChevronForward className="text-primary" size={16} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {allFunded ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-[13px] font-semibold text-emerald-800">
            <IoCheckmarkCircle size={18} />
            All guests funded — plan can go active.
          </div>
        ) : isHost ? (
          <p className="text-[12px] font-semibold text-muted">
            Plan becomes active when all guests have funded their escrow.
          </p>
        ) : null}
      </div>
    </section>
  );
}
