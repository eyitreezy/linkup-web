'use client';

import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import type {
  DbDispute,
  DbDisputeEvidence,
  PlanDisputeResolution,
  PlanDisputeStatus,
} from '@/types/database';
import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  payment_issue: 'Payment issue',
  no_show: 'No-show',
  misconduct: 'Misconduct',
  scam: 'Scam',
  other: 'Other',
};

type EvidenceRow = DbDisputeEvidence & { signedUrl?: string | null };

type Props = {
  dispute: DbDispute;
  evidence: EvidenceRow[];
  planTitle?: string | null;
};

function statusPillClass(status: PlanDisputeStatus): string {
  switch (status) {
    case 'resolved':
      return 'bg-emerald-500/15 text-emerald-800';
    case 'rejected':
      return 'bg-red-500/10 text-red-700';
    case 'reviewing':
      return 'bg-primary/10 text-primary';
    default:
      return 'bg-primary/10 text-primary';
  }
}

function statusLabel(status: PlanDisputeStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function ResolutionOutcome({
  resolution,
  adminNote,
  status,
}: {
  resolution: PlanDisputeResolution | null;
  adminNote: string | null;
  status: PlanDisputeStatus;
}) {
  const byResolution: Record<string, string> = {
    refund: 'A full refund was applied where applicable.',
    partial: 'A partial resolution was applied.',
    none: 'This dispute was not upheld.',
  };
  const outcomeText =
    (resolution ? byResolution[resolution] : undefined) ??
    (status === 'rejected' ? 'This dispute was not upheld.' : 'Reviewed.');

  return (
    <div className="space-y-2">
      <p className="text-[14px] font-semibold text-foreground">{outcomeText}</p>
      {adminNote ? (
        <div className="rounded-xl border border-border bg-[#F5F6FA] p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Note from support</p>
          <p className="mt-1 text-[14px] font-semibold leading-relaxed text-foreground">{adminNote}</p>
        </div>
      ) : null}
    </div>
  );
}

export function DisputeDetailView({ dispute, evidence, planTitle }: Props) {
  const videoEvidence = evidence.find((e) => e.type === 'video' && e.signedUrl);
  const imageEvidence = evidence.filter((e) => e.type === 'image' && e.signedUrl);
  const showResolution = dispute.status === 'resolved' || dispute.status === 'rejected';

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <SettingsPageHeader
        kicker="Trust"
        title="Plan dispute"
        subtitle={planTitle ?? `Plan ${dispute.plan_id.slice(0, 8)}…`}
        backHref="/disputes"
        backLabel="Back to disputes"
        actions={
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusPillClass(dispute.status)}`}
          >
            {statusLabel(dispute.status)}
          </span>
        }
      />

      <div className="linkup-card divide-y divide-border/60">
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="text-[13px] font-semibold text-muted">Plan</span>
          <Link href={`/plan/${dispute.plan_id}`} className="text-[13px] font-extrabold text-primary hover:underline">
            View plan →
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="text-[13px] font-semibold text-muted">Filed</span>
          <span className="text-[13px] font-semibold text-foreground">
            {new Date(dispute.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="text-[13px] font-semibold text-muted">Category</span>
          <span className="text-[13px] font-extrabold text-foreground">
            {CATEGORY_LABELS[dispute.category] ?? dispute.category}
          </span>
        </div>
      </div>

      <div className="linkup-card space-y-3 p-4">
        <h3 className="text-[13px] font-extrabold text-foreground">Your submission</h3>
        {videoEvidence?.signedUrl ? (
          <video
            src={videoEvidence.signedUrl}
            controls
            className="aspect-video w-full rounded-xl bg-black"
          />
        ) : null}
        {imageEvidence.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageEvidence.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.signedUrl!}
                alt=""
                className="h-24 w-24 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}
        {dispute.reporter_note ? (
          <div className="rounded-xl bg-[#F5F6FA] p-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Your note</p>
            <p className="mt-1 text-[14px] font-semibold leading-relaxed text-foreground">
              {dispute.reporter_note}
            </p>
          </div>
        ) : null}
      </div>

      {showResolution ? (
        <div className="linkup-card space-y-2 p-4">
          <h3 className="text-[13px] font-extrabold text-foreground">Resolution</h3>
          <ResolutionOutcome
            resolution={dispute.resolution}
            adminNote={dispute.admin_note}
            status={dispute.status}
          />
        </div>
      ) : (
        <p className="text-center text-[13px] font-semibold text-muted">
          Our team is reviewing your submission. You&apos;ll be notified when there&apos;s an update.
        </p>
      )}
    </div>
  );
}
