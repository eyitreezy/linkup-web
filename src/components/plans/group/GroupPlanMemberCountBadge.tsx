'use client';

import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import { countGroupFundedMembers } from '@/lib/plans/groupFundedMemberCount';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IoPeopleOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  hostUserId: string;
  hostEscrowId?: string | null;
  /** Current roster size (accepted guests + host). */
  memberCapacity: number;
  /** Max plan capacity (max guests + host), used as fallback only. */
  maxCapacity?: number;
  minimumCount?: number;
  /** Bumps when parent refetches plan / escrow state. */
  refreshKey?: string;
};

const ESCROW_SELECT =
  'id, guest_id, host_id, payer_id, status, escrow_pattern, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents';

export function GroupPlanMemberCountBadge({
  planId,
  hostUserId,
  hostEscrowId,
  memberCapacity,
  maxCapacity,
  minimumCount = 5,
  refreshKey,
}: Props) {
  const [count, setCount] = useState(0);
  const [capacity, setCapacity] = useState(memberCapacity);
  const [minimum, setMinimum] = useState(minimumCount);

  useEffect(() => {
    const nextCapacity = Math.max(1, memberCapacity || maxCapacity || 1);
    setCapacity(nextCapacity);
    setMinimum(minimumCount);
  }, [maxCapacity, memberCapacity, minimumCount]);

  const loadFundedCount = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from('escrow_transactions')
      .select(ESCROW_SELECT)
      .eq('plan_id', planId);

    const escrows = data ?? [];
    setCount(
      countGroupFundedMembers(
        { creator_id: hostUserId, host_escrow_id: hostEscrowId ?? null },
        escrows
      )
    );
  }, [hostEscrowId, hostUserId, planId]);

  const loadRef = useRef(loadFundedCount);
  loadRef.current = loadFundedCount;

  useEffect(() => {
    void loadFundedCount();
  }, [loadFundedCount, refreshKey]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`plan-members:${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plans',
          filter: `id=eq.${planId}`,
        },
        (payload) => {
          const row = payload.new as {
            accepted_guest_count?: number;
            max_guests?: number;
            minimum_member_count?: number;
          };
          if (row.accepted_guest_count != null) {
            setCapacity(Math.max(1, row.accepted_guest_count + 1));
          } else if (row.max_guests != null) {
            setCapacity(Math.max(1, row.max_guests + 1));
          }
          if (row.minimum_member_count != null) setMinimum(row.minimum_member_count);
          void loadRef.current();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [planId]);

  useEffect(() => {
    return subscribeEscrowRealtime({
      planId,
      onRefresh: () => {
        void loadRef.current();
      },
    });
  }, [planId]);

  const displayCapacity = Math.max(capacity, 1);
  const belowMinimum = count < minimum;
  const fillPct = Math.min(100, Math.round((count / displayCapacity) * 100));

  return (
    <div className="rounded-xl border border-primary/10 bg-[#F8F9FC] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE8FF] text-primary">
          <IoPeopleOutline size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[13px] font-extrabold leading-tight text-foreground">
              <span className="text-primary">{count}</span>
              <span className="text-muted"> of {displayCapacity}</span>
              <span className="font-semibold text-muted"> members confirmed</span>
            </p>

            {belowMinimum ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
                Min {minimum} required
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                Minimum met
              </span>
            )}
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/40">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                belowMinimum ? 'bg-amber-500' : 'bg-primary'
              )}
              style={{ width: `${fillPct}%` }}
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={displayCapacity}
              aria-label={`${count} of ${displayCapacity} members confirmed`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
