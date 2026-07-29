'use client';

import {
  AdminEmptyState,
  AdminListCard,
  AdminPrimaryButton,
  AdminSectionHeader,
  StatusPill,
} from '@/features/admin/adminUi';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { IoCheckmarkDoneOutline, IoStarOutline } from 'react-icons/io5';

type ReviewReportRow = {
  id: string;
  reason: string;
  reason_text: string | null;
  reported_at: string;
  reporter?: { display_name: string | null } | { display_name: string | null }[] | null;
  review?: {
    id: string;
    review_text: string | null;
    score_punctuality: number;
    score_conduct: number;
    score_plan_quality: number | null;
    reviewee_id: string;
    reviewer_role: string;
  } | {
    id: string;
    review_text: string | null;
    score_punctuality: number;
    score_conduct: number;
    score_plan_quality: number | null;
    reviewee_id: string;
    reviewer_role: string;
  }[] | null;
};

type Props = {
  adminUserId: string | null;
  onReload?: () => void;
};

export function AdminReviewReportsPanel({ adminUserId, onReload }: Props) {
  const [rows, setRows] = useState<ReviewReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const client = createClient();
    const { data, error } = await client
      .from('review_reports')
      .select(`
        id,
        reason,
        reason_text,
        reported_at,
        reporter:profiles!reporter_id ( display_name ),
        review:meetup_reviews (
          id,
          review_text,
          score_punctuality,
          score_conduct,
          score_plan_quality,
          reviewee_id,
          reviewer_role
        )
      `)
      .eq('status', 'pending')
      .order('reported_at', { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ReviewReportRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSuppress(report: ReviewReportRow) {
    if (!adminUserId) return;
    const reviewRaw = report.review;
    const review = Array.isArray(reviewRaw) ? reviewRaw[0] : reviewRaw;
    if (!review) return;

    setBusyId(report.id);
    setErr(null);
    const client = createClient();
    const now = new Date().toISOString();

    const { error: reportError } = await client
      .from('review_reports')
      .update({
        status: 'suppressed',
        reviewed_by: adminUserId,
        reviewed_at: now,
      })
      .eq('id', report.id);

    if (reportError) {
      setErr(reportError.message);
      setBusyId(null);
      return;
    }

    const { error: reviewError } = await client
      .from('meetup_reviews')
      .update({
        is_suppressed: true,
        suppressed_by: adminUserId,
        suppressed_at: now,
      })
      .eq('id', review.id);

    if (reviewError) {
      setErr(reviewError.message);
      setBusyId(null);
      return;
    }

    await client.rpc('recompute_profile_ratings', { p_user_id: review.reviewee_id });
    await load();
    onReload?.();
    setBusyId(null);
  }

  async function handleDismiss(reportId: string) {
    if (!adminUserId) return;
    setBusyId(reportId);
    setErr(null);
    const client = createClient();
    const { error } = await client
      .from('review_reports')
      .update({
        status: 'dismissed',
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (error) setErr(error.message);
    else {
      await load();
      onReload?.();
    }
    setBusyId(null);
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminSectionHeader
        title="Review reports"
        subtitle="Pending member reports on meetup reviews. Suppress removes a review from public view and recalculates ratings."
        icon={<IoStarOutline size={22} className="text-primary" />}
      />

      {err ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="h-28 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="Queue clear"
          subtitle="No pending review reports."
          icon={<IoCheckmarkDoneOutline size={40} />}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
            const reviewRaw = row.review;
            const review = Array.isArray(reviewRaw) ? reviewRaw[0] : reviewRaw;

            return (
              <li key={row.id}>
                <AdminListCard>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <StatusPill label={row.reason} tone="warn" />
                      <p className="mt-2 text-[13px] font-extrabold text-foreground">
                        Reported by {reporter?.display_name?.trim() || 'Member'}
                      </p>
                      <p className="text-[11px] font-semibold text-muted">
                        {new Date(row.reported_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {row.reason_text ? (
                    <p className="mt-3 text-[13px] font-semibold text-muted">{row.reason_text}</p>
                  ) : null}

                  {review ? (
                    <div className="mt-3 rounded-xl border border-border/70 bg-[#F8F7FF]/50 p-3">
                      <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">
                        Review excerpt
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-foreground">
                        {review.review_text?.trim() || 'No written review.'}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-muted">
                        Scores: punctuality {review.score_punctuality}, conduct {review.score_conduct}
                        {review.score_plan_quality != null
                          ? `, plan quality ${review.score_plan_quality}`
                          : ''}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminPrimaryButton
                      disabled={busyId === row.id}
                      onClick={() => void handleSuppress(row)}
                      className="!bg-red-600 hover:!bg-red-700"
                    >
                      {busyId === row.id ? 'Working…' : 'Suppress review'}
                    </AdminPrimaryButton>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void handleDismiss(row.id)}
                      className="min-h-[44px] rounded-full border border-border px-4 text-[13px] font-extrabold text-muted hover:bg-[#EDE8FF]/50 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </AdminListCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
