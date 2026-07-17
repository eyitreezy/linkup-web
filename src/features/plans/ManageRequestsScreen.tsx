'use client';

import { JoinRequestRow } from '@/components/plans/joinRequests/JoinRequestRow';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import {
  fetchPlanJoinRequests,
  respondToJoinRequest,
  type JoinRequestWithRequester,
} from '@/lib/plans/joinRequests';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { createClient } from '@/lib/supabase/client';
import type { DbPlan } from '@/types/database';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoPeople } from 'react-icons/io5';

type Props = {
  plan: DbPlan;
  initialRequests: JoinRequestWithRequester[];
};

export function ManageRequestsScreen({ plan, initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<JoinRequestWithRequester | null>(null);
  const [statusAlert, setStatusAlert] = useState<{ title: string; message: string } | null>(null);

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const responded = useMemo(() => requests.filter((r) => r.status !== 'pending'), [requests]);
  const slotLabel = resolveJoinRequestSlotCentsLabel(plan);

  const refetchRequests = useCallback(async () => {
    const next = await fetchPlanJoinRequests(plan.id);
    setRequests(next);
  }, [plan.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`join-requests-web-${plan.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_join_requests',
          filter: `plan_id=eq.${plan.id}`,
        },
        () => {
          void refetchRequests();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [plan.id, refetchRequests]);

  async function runRespond(requestId: string, action: 'approve' | 'decline') {
    setBusyId(requestId);
    try {
      await respondToJoinRequest(requestId, action);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: action === 'approve' ? 'approved' : 'declined' }
            : r
        )
      );
      void refetchRequests();
    } catch {
      setStatusAlert({
        title: 'Something went wrong',
        message: 'Please try again.',
      });
    } finally {
      setBusyId(null);
      setDeclineTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1 py-2 sm:px-0">
      <PlanFlowHeader
        kicker="Requests"
        title="Manage requests"
        subtitle={plan.title}
        backHref={`/plan/${plan.id}`}
        backLabel="Back to plan"
      />

      <div className="linkup-card space-y-2 p-4 text-[13px] font-semibold text-muted">
        <p className="font-extrabold text-foreground">{plan.title}</p>
        <p>
          {`Guests request to join at the formula share${slotLabel ? ` (${slotLabel})` : ''}. Approve to create their escrow leg at that price.`}
        </p>
      </div>

      {pending.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {`Pending (${pending.length})`}
          </h3>
          <div className="space-y-2">
            {pending.map((request) => (
              <JoinRequestRow
                key={request.id}
                request={request}
                busy={busyId === request.id}
                onApprove={() => void runRespond(request.id, 'approve')}
                onDecline={() => setDeclineTarget(request)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {responded.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Responded</h3>
          <div className="space-y-2">
            {responded.map((request) => (
              <JoinRequestRow key={request.id} request={request} />
            ))}
          </div>
        </section>
      ) : null}

      {requests.length === 0 ? (
        <AppEmptyState
          icon={<IoPeople size={40} className="text-muted/40" />}
          title="No requests yet"
          description="When guests request to join your plan, they will appear here."
          className="border border-dashed border-primary/20"
        />
      ) : null}

      <ConfirmDialog
        open={declineTarget !== null}
        title="Decline request?"
        message={
          declineTarget
            ? `Decline ${declineTarget.requester?.display_name?.trim() || 'this guest'}'s request to join?`
            : ''
        }
        cancelLabel="Cancel"
        confirmLabel="Decline"
        confirmVariant="danger"
        busy={busyId !== null}
        onClose={() => !busyId && setDeclineTarget(null)}
        onConfirm={() => {
          if (declineTarget) void runRespond(declineTarget.id, 'decline');
        }}
      />

      <AppStatusDialog
        open={statusAlert !== null}
        variant="error"
        title={statusAlert?.title ?? ''}
        message={statusAlert?.message ?? ''}
        onClose={() => setStatusAlert(null)}
      />
    </div>
  );
}
