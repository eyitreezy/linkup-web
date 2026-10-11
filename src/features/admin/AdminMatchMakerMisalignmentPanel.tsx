'use client';

import {
  AdminEmptyState,
  AdminListCard,
  AdminPrimaryButton,
  AdminSectionHeader,
  StatusPill,
} from '@/features/admin/adminUi';
import { reviewMatchMakerMisalignmentFlag } from '@/services/admin.service';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

type QueueRow = {
  reported_user_id: string;
  flag_raised_at: string;
  distinct_connection_count: number;
  review_status: string;
};

export function AdminMatchMakerMisalignmentPanel() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const client = createClient();
    const { data, error } = await client.rpc('admin_list_matchmaker_misalignment_queue');
    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as QueueRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(userId: string, confirmed: boolean) {
    setBusyId(userId);
    const { error } = await reviewMatchMakerMisalignmentFlag(userId, confirmed);
    setBusyId(null);
    if (error) {
      setErr(error);
      return;
    }
    void load();
  }

  return (
    <div className="mt-10">
      <AdminSectionHeader
        title="MatchMaker misalignment queue"
        subtitle="Two or more reports from different connections within 90 days. Confirm a pattern before suspending MatchMaker access."
      />
      {err ? <p className="mt-2 text-[13px] font-semibold text-[#EF4444]">{err}</p> : null}
      {loading ? <p className="mt-4 text-[13px] font-semibold text-muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <AdminEmptyState title="No flags" subtitle="No pending MatchMaker misalignment reviews." />
      ) : null}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <AdminListCard key={row.reported_user_id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <StatusPill
                  label={row.review_status}
                  tone={row.review_status === 'pending' ? 'warn' : 'neutral'}
                />
                <p className="mt-2 text-[13px] font-semibold text-muted">
                  Reported user: <span className="font-mono text-[12px]">{row.reported_user_id}</span>
                </p>
                <p className="mt-1 text-[13px] font-semibold text-muted">
                  Distinct connections (90d): {row.distinct_connection_count}
                </p>
              </div>
              {row.review_status === 'pending' ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <AdminPrimaryButton
                    disabled={busyId === row.reported_user_id}
                    onClick={() => void review(row.reported_user_id, false)}
                  >
                    Not confirmed
                  </AdminPrimaryButton>
                  <AdminPrimaryButton
                    disabled={busyId === row.reported_user_id}
                    onClick={() => void review(row.reported_user_id, true)}
                  >
                    Confirm pattern
                  </AdminPrimaryButton>
                </div>
              ) : null}
            </div>
          </AdminListCard>
        ))}
      </ul>
    </div>
  );
}
