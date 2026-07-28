'use client';

import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { submitHostMinimumAction } from '@/lib/groupPlan/liveLocation';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function MinimumActionClient() {
  const params = useParams();
  const planId = String(params.id ?? '');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ current: number; required: number } | null>(null);

  useEffect(() => {
    const client = createClient();
    void client
      .from('plans')
      .select('accepted_guest_count, minimum_member_count, creator_id')
      .eq('id', planId)
      .single()
      .then(({ data, error: qErr }) => {
        if (qErr || !data) return;
        setCounts({
          current: data.accepted_guest_count ?? 0,
          required: data.minimum_member_count ?? 5,
        });
      });
  }, [planId]);

  async function handleAction(action: 'extend_registration' | 'proceed_smaller' | 'cancel') {
    setBusy(true);
    setError(null);
    const result = await submitHostMinimumAction(planId, action);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(result.cancelled ? '/discover' : `/plan/${planId}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Group minimum"
        title="Your group needs more members"
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
      />

      <div className="linkup-card space-y-4 p-5">
        {counts ? (
          <p className="text-[14px] font-semibold text-muted">
            Current members:{' '}
            <span className="font-extrabold text-foreground">
              {counts.current} of {counts.required}
            </span>
          </p>
        ) : null}
        <p className="text-[14px] font-semibold leading-relaxed text-muted">
          Your meetup is in 48 hours and has not reached the minimum of 5 members. Choose one of the
          following options. If you do not respond within 24 hours, the plan will be automatically
          cancelled and all contributions will be refunded.
        </p>
        {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
        <button
          type="button"
          onClick={() => void handleAction('extend_registration')}
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary text-[14px] font-extrabold text-white disabled:opacity-50"
        >
          Extend registration period
        </button>
        <button
          type="button"
          onClick={() => void handleAction('proceed_smaller')}
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-border text-[14px] font-extrabold text-foreground disabled:opacity-50"
        >
          Proceed as a smaller private group
        </button>
        <button
          type="button"
          onClick={() => void handleAction('cancel')}
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#EF4444] text-[14px] font-extrabold text-white disabled:opacity-50"
        >
          Cancel the Group Plan
        </button>
        <p className="text-[12px] font-semibold text-muted">
          All contributions will be refunded in full with no platform fee deducted if you choose to cancel.
        </p>
      </div>
    </div>
  );
}
