'use client';

import {
  AdminEmptyState,
  AdminListCard,
  AdminMetaRow,
  AdminModal,
  AdminPrimaryButton,
  AdminSectionHeader,
  shortUuid,
  StatusPill,
} from '@/features/admin/adminUi';
import { SlaDeadlineBadge } from '@/components/admin/SlaDeadlineBadge';
import { createClient } from '@/lib/supabase/client';
import type { DbExigencyReport, ExigencyOutcome } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';
import { IoCalendarOutline, IoCheckmarkDoneOutline, IoTimeOutline } from 'react-icons/io5';

const OUTCOMES: { value: ExigencyOutcome; label: string; refund: number; host: number }[] = [
  { value: 'late_arrival_confirmed', label: 'Outcome 1: Late arrival confirmed', refund: 0, host: 100 },
  { value: 'force_majeure_approved', label: 'Outcome 2: Force majeure', refund: 100, host: 0 },
  { value: 'unsatisfactory', label: 'Outcome 4: Unsatisfactory', refund: 70, host: 30 },
  { value: 'fairly_satisfactory', label: 'Outcome 5: Fairly satisfactory', refund: 80, host: 20 },
];

type Props = {
  onReload?: () => void;
};

export function AdminExigencySection({ onReload }: Props) {
  const [rows, setRows] = useState<DbExigencyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DbExigencyReport | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ExigencyOutcome>('fairly_satisfactory');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const client = createClient();
    const { data } = await client
      .from('exigency_reports')
      .select('*')
      .eq('outcome', 'pending_review')
      .order('review_deadline_at', { ascending: true });
    setRows((data as DbExigencyReport[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyOutcome() {
    if (!detail) return;
    const preset = OUTCOMES.find((o) => o.value === selectedOutcome);
    if (!preset) return;
    setBusy(true);
    setError(null);
    const client = createClient();
    const { error: rpcErr } = await client.rpc('admin_apply_exigency_outcome', {
      p_report_id: detail.id,
      p_outcome: preset.value,
      p_refund_percent: preset.refund,
      p_host_percent: preset.host,
      p_review_notes: notes.trim() || null,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setDetail(null);
    setNotes('');
    void load();
    onReload?.();
  }

  return (
    <>
      <AdminSectionHeader
        title="Exigency Reports"
        subtitle="Non-confirming group members. Review before the deadline."
        icon={<IoTimeOutline size={22} className="text-primary" />}
      />
      {loading ? (
        <p className="text-[14px] font-semibold text-muted">Loading exigency queue…</p>
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="Queue clear"
          subtitle="No pending exigency reports."
          icon={<IoCheckmarkDoneOutline size={40} />}
        />
      ) : (
        <ul className="mb-10 space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <AdminListCard onClick={() => setDetail(row)}>
                <p className="font-extrabold text-foreground">{row.reason_type.replace(/_/g, ' ')}</p>
                <StatusPill label="pending review" tone="warn" />
                <AdminMetaRow icon={<IoCalendarOutline size={14} />}>
                  Plan {shortUuid(row.plan_id, 12)}
                </AdminMetaRow>
                <AdminMetaRow icon={<IoTimeOutline size={14} />}>
                  Due {new Date(row.review_deadline_at).toLocaleString()}
                </AdminMetaRow>
                <SlaDeadlineBadge deadline={row.review_deadline_at} />
              </AdminListCard>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={!!detail}
        title="Review Exigency Report"
        onClose={() => !busy && setDetail(null)}
      >
        {detail ? (
          <div className="space-y-4">
            <p className="text-[14px] font-semibold text-muted">{detail.reason_text}</p>
            <label className="block text-[12px] font-extrabold uppercase text-muted">Outcome</label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value as ExigencyOutcome)}
              className="w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.refund}% guest / {o.host}% host)
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Review notes (optional)"
              className="w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
            />
            {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
            <AdminPrimaryButton disabled={busy} onClick={() => void applyOutcome()}>
              {busy ? 'Applying…' : 'Apply outcome'}
            </AdminPrimaryButton>
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}
