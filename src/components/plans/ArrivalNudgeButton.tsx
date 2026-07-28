'use client';

import {
  canReportNoShow,
  isArrivalWindowActive,
  submitArrivalNudge,
} from '@/lib/groupPlan/annexureB';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IoCheckmarkCircle, IoWarningOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  currentUserId: string;
  planStatus: string;
  scheduledAt: string | null;
  partnerNudgedAt?: string | null;
  myNudgedAt?: string | null;
  reportedUserId?: string | null;
};

export function ArrivalNudgeButton({
  planId,
  currentUserId,
  planStatus,
  scheduledAt,
  partnerNudgedAt: partnerNudgedAtProp,
  myNudgedAt: myNudgedAtProp,
  reportedUserId,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [nudgedAt, setNudgedAt] = useState<string | null>(myNudgedAtProp ?? null);
  const [partnerNudgedAt, setPartnerNudgedAt] = useState<string | null>(partnerNudgedAtProp ?? null);

  useEffect(() => {
    setNudgedAt(myNudgedAtProp ?? null);
  }, [myNudgedAtProp]);

  useEffect(() => {
    setPartnerNudgedAt(partnerNudgedAtProp ?? null);
  }, [partnerNudgedAtProp]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`nudges:${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'plan_arrival_nudges',
          filter: `plan_id=eq.${planId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; nudged_at: string };
          if (row.user_id === currentUserId) {
            setNudgedAt(row.nudged_at);
          } else {
            setPartnerNudgedAt(row.nudged_at);
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [planId, currentUserId]);

  const showNudge =
    planStatus === 'active' && isArrivalWindowActive(scheduledAt);

  const showNoShow = canReportNoShow(partnerNudgedAt, nudgedAt) && !!reportedUserId;

  if (!showNudge && !nudgedAt && !showNoShow) return null;

  async function handleNudge() {
    if (nudgedAt || isLoading) return;
    setIsLoading(true);
    try {
      const result = await submitArrivalNudge(planId);
      if (result.nudged_at) setNudgedAt(result.nudged_at);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border-b border-border/60 px-2.5 py-2 min-[360px]:px-4">
      {nudgedAt ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/90 px-3 py-2">
          <div className="flex items-center gap-2">
            <IoCheckmarkCircle className="shrink-0 text-emerald-600" size={18} />
            <span className="text-[13px] font-extrabold text-emerald-800">You have arrived</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700">
            {new Date(nudgedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ) : showNudge ? (
        <button
          type="button"
          onClick={() => void handleNudge()}
          disabled={isLoading}
          className={cn(
            'flex min-h-[40px] w-full items-center justify-center rounded-full linkup-gradient-primary px-4 text-[13px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
          )}
        >
          {isLoading ? 'Sending…' : 'I Have Arrived'}
        </button>
      ) : null}

      {partnerNudgedAt && !nudgedAt ? (
        <p className="mt-1.5 text-center text-[11px] font-semibold text-muted">
          Your partner arrived at{' '}
          {new Date(partnerNudgedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
        </p>
      ) : null}

      {showNoShow ? (
        <Link
          href={`/dispute/${planId}?reported=${reportedUserId}`}
          className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-[13px] font-extrabold text-red-700 transition hover:bg-red-100"
        >
          <IoWarningOutline size={16} />
          Report No-Show
        </Link>
      ) : null}
    </div>
  );
}
