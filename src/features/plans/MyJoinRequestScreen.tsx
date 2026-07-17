'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import {
  fetchGuestEscrowIdForJoinRequest,
  fetchMyJoinRequest,
} from '@/lib/plans/joinRequests';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { createClient } from '@/lib/supabase/client';
import type { DbPlan, JoinRequestStatus } from '@/types/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function statusCopy(status: JoinRequestStatus): { title: string; body: string } {
  switch (status) {
    case 'approved':
      return {
        title: 'Request approved',
        body: 'Your slot is reserved. Fund your share to confirm your place on this plan.',
      };
    case 'declined':
      return {
        title: 'Request not approved',
        body: 'The host did not approve your request. You can explore other plans on LinkUp.',
      };
    default:
      return {
        title: 'Request pending',
        body: 'The host will review your request. You will be notified when they respond.',
      };
  }
}

type Props = {
  plan: DbPlan;
  initialStatus: JoinRequestStatus | null;
  currentUserId: string;
};

export function MyJoinRequestScreen({ plan, initialStatus, currentUserId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JoinRequestStatus | null>(initialStatus);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const req = await fetchMyJoinRequest(plan.id, currentUserId);
      setStatus(req?.status ?? null);
    } finally {
      setLoading(false);
    }
  }, [plan.id, currentUserId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`my-join-request-web-${plan.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_join_requests',
          filter: `plan_id=eq.${plan.id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [plan.id, load]);

  async function goFund() {
    const escrowId = await fetchGuestEscrowIdForJoinRequest(plan.id, currentUserId);
    if (escrowId) {
      router.push(`/escrow/${escrowId}`);
      return;
    }
    router.push(`/plan/${plan.id}/agreement`);
  }

  const copy = status ? statusCopy(status) : null;
  const slotLabel = resolveJoinRequestSlotCentsLabel(plan);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1 py-2 sm:px-0">
      <PlanFlowHeader
        kicker="Join request"
        title="Your request"
        subtitle={plan.title}
        backHref={`/plan/${plan.id}`}
        backLabel="Back to plan"
      />

      {loading && !copy ? (
        <p className="text-center text-[14px] font-semibold text-muted">Loading…</p>
      ) : !copy ? (
        <AppEmptyState
          title="No request found"
          description="You have not sent a join request for this plan yet."
          className="border border-dashed border-primary/20"
        />
      ) : (
        <div className="linkup-card space-y-4 p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Join request</p>
          <h2 className="font-display text-xl font-extrabold text-foreground">{copy.title}</h2>
          <p className="text-[14px] font-semibold leading-relaxed text-muted">{copy.body}</p>
          {slotLabel ? (
            <p className="text-[15px] font-extrabold text-primary">{`Formula share: ${slotLabel}`}</p>
          ) : null}
          {status === 'approved' ? (
            <button
              type="button"
              onClick={() => void goFund()}
              className="flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95"
            >
              Fund your share
            </button>
          ) : null}
          {status === 'declined' ? (
            <Link
              href="/discover"
              className="flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95"
            >
              Explore plans
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
