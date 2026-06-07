'use client';

import { AdminPlansPanel, AdminUsersPanel } from '@/features/admin/AdminUsersPlansPanels';
import {
  AdminEmptyState,
  AdminListCard,
  AdminMetaRow,
  AdminModal,
  AdminMonoBlock,
  AdminPrimaryButton,
  AdminSectionHeader,
  CopyIdsButton,
  FilterChip,
  shortUuid,
  StatusPill,
} from '@/features/admin/adminUi';
import {
  escrowStatusTone,
  formatEscrowAmount,
  formatModerationScore,
  kycStatusTone,
  moderationActionLabel,
  moderationAuditSummary,
  moderationContentLabel,
  moderationFlagLabel,
  reportStatusTone,
  ticketPriorityTone,
  ticketStatusTone,
} from '@/lib/admin/adminLabels';
import {
  approveVerification,
  getDisputeEvidenceSignedUrl,
  loadKycExtras,
  loadPlanDisputeEvidence,
  loadReportSnippet,
  rejectVerification,
  resolveEscrowDispute,
  resolvePlanDispute,
  resolveReport,
  savePlanDisputeNotes,
  suspendReportedUser,
  updateSupportTicket,
  warnReportedUser,
  type AdminDashboardData,
  type EscrowDisputeRow,
  type VerRow,
} from '@/services/admin.service';
import type { DbDispute, DbDisputeEvidence, DbModerationLog, DbReport, DbSupportTicket, DbVerificationEvent } from '@/types/database';
import Link from 'next/link';
import { useState } from 'react';
import {
  IoAlbumsOutline,
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoChatbubblesOutline,
  IoCheckmarkDoneOutline,
  IoFingerPrintOutline,
  IoFlagOutline,
  IoFlashOutline,
  IoPeopleOutline,
  IoPersonOutline,
  IoScaleOutline,
  IoTimeOutline,
  IoWalletOutline,
} from 'react-icons/io5';

type Reload = () => void;

export function AdminVerifyPanel({
  data,
  adminRecordId,
  onReload,
}: {
  data: AdminDashboardData;
  adminRecordId: string | null;
  onReload: Reload;
}) {
  const [expandedKyc, setExpandedKyc] = useState<string | null>(null);
  const [kycExtras, setKycExtras] = useState<{
    events: DbVerificationEvent[];
    idUrl: string | null;
    selfieUrl: string | null;
  } | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function toggleKyc(row: VerRow) {
    if (expandedKyc === row.id) {
      setExpandedKyc(null);
      setKycExtras(null);
      return;
    }
    setExpandedKyc(row.id);
    const extras = await loadKycExtras(row);
    setKycExtras(extras);
  }

  return (
    <div className="min-w-0">
      <AdminSectionHeader
        title="Verification queue"
        subtitle="Tap a row for timeline, secure ID and liveness links (1 h expiry)."
        icon={<IoFingerPrintOutline size={22} />}
      />
      {data.ver.length === 0 ? (
        <AdminEmptyState title="Queue clear" subtitle="No verification requests right now." icon={<IoCheckmarkDoneOutline size={40} />} />
      ) : (
        <ul className="space-y-3">
          {data.ver.map((row) => {
            const prof = data.kycProfiles[row.user_id];
            const open = expandedKyc === row.id;
            const canDecide = row.status === 'pending';
            return (
              <li key={row.id}>
                <AdminListCard onClick={() => void toggleKyc(row)}>
                  <div className="flex flex-wrap items-start gap-3">
                    {prof?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={prof.avatar_url} alt="" className="h-12 w-12 rounded-full border-2 border-primary/15 object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE8FF] text-primary">
                        <IoPersonOutline size={22} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-foreground">{prof?.display_name?.trim() || 'Member'}</p>
                      <StatusPill label={row.status} tone={kycStatusTone(row.status)} />
                      <AdminMetaRow icon={<IoTimeOutline size={14} />}>
                        {new Date(row.created_at).toLocaleString()}
                      </AdminMetaRow>
                      {row.rejection_reason ? (
                        <p className="mt-2 text-[13px] font-semibold text-red-600">{row.rejection_reason}</p>
                      ) : null}
                    </div>
                    <span className="text-[12px] font-extrabold text-primary">{open ? 'Collapse' : 'Review'}</span>
                  </div>
                  {open && kycExtras ? (
                    <div className="mt-4 space-y-4 border-t border-border/80 pt-4" onClick={(e) => e.stopPropagation()}>
                      {kycExtras.events.length > 0 ? (
                        <ul className="space-y-2">
                          {kycExtras.events.map((ev) => (
                            <li key={ev.id} className="rounded-xl bg-[#F5F6FA] px-3 py-2 text-[12px] font-semibold text-muted">
                              {ev.event_type.replace(/_/g, ' ')} · {new Date(ev.created_at).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {kycExtras.idUrl ? (
                        <a href={kycExtras.idUrl} target="_blank" rel="noopener noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={kycExtras.idUrl} alt="ID document" className="max-h-56 w-full rounded-xl border object-contain" />
                        </a>
                      ) : null}
                      {kycExtras.selfieUrl ? (
                        <video src={kycExtras.selfieUrl} controls className="max-h-56 w-full rounded-xl border" />
                      ) : null}
                      {canDecide ? (
                        <div className="flex flex-wrap gap-2">
                          <AdminPrimaryButton
                            onClick={async () => {
                              await approveVerification(row.id, adminRecordId);
                              setExpandedKyc(null);
                              onReload();
                            }}
                          >
                            Approve
                          </AdminPrimaryButton>
                          <AdminPrimaryButton variant="danger" onClick={() => setRejectFor(row.id)}>
                            Reject
                          </AdminPrimaryButton>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </AdminListCard>
              </li>
            );
          })}
        </ul>
      )}

      <AdminModal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        title="Rejection reason"
        kicker="Verification"
        accent="danger"
        footer={
          <div className="flex flex-wrap gap-2">
            <AdminPrimaryButton variant="ghost" onClick={() => setRejectFor(null)}>
              Cancel
            </AdminPrimaryButton>
            <AdminPrimaryButton
              variant="danger"
              disabled={!rejectReason.trim()}
              onClick={async () => {
                if (!rejectFor || !rejectReason.trim()) return;
                await rejectVerification(rejectFor, rejectReason, adminRecordId);
                setRejectFor(null);
                setRejectReason('');
                setExpandedKyc(null);
                onReload();
              }}
            >
              Reject member
            </AdminPrimaryButton>
          </div>
        }
      >
        <p className="text-[13px] font-semibold text-muted">Required — this text is shared with the member.</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="Explain what to fix or resubmit"
          className="mt-3 w-full resize-none rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none focus:border-primary/40"
        />
      </AdminModal>
    </div>
  );
}

export function AdminReportsPanel({ data, onReload }: { data: AdminDashboardData; onReload: Reload }) {
  const [detail, setDetail] = useState<DbReport | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);

  const sorted = [...data.reports].sort((a, b) => {
    const order: Record<string, number> = { pending: 0, reviewed: 1, resolved: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  async function open(r: DbReport) {
    setDetail(r);
    setSnippet(await loadReportSnippet(r));
  }

  return (
    <>
      <AdminSectionHeader
        title="Safety reports"
        subtitle="User and content reports — resolve, warn, or suspend from detail."
        icon={<IoFlagOutline size={22} className="text-primary" />}
      />
      {sorted.length === 0 ? (
        <AdminEmptyState title="No reports" subtitle="Nothing pending in this queue." />
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => (
            <li key={r.id}>
              <AdminListCard onClick={() => void open(r)}>
                <p className="text-[16px] font-extrabold text-foreground">{r.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill label={r.status} tone={reportStatusTone(r.status)} />
                  <StatusPill label={r.content_type} tone="neutral" />
                </div>
                <AdminMetaRow icon={<IoTimeOutline size={14} />}>
                  {new Date(r.created_at).toLocaleString()}
                </AdminMetaRow>
              </AdminListCard>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Report detail"
        kicker="Safety"
        footer={
          detail ? (
            <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap">
              <AdminPrimaryButton
                onClick={async () => {
                  await resolveReport(detail.id);
                  setDetail(null);
                  onReload();
                }}
              >
                Mark resolved
              </AdminPrimaryButton>
              <AdminPrimaryButton
                variant="secondary"
                onClick={async () => {
                  await warnReportedUser(detail.reported_user_id);
                  onReload();
                }}
              >
                Warn reported user
              </AdminPrimaryButton>
              <AdminPrimaryButton
                variant="danger"
                onClick={async () => {
                  if (!window.confirm('Suspend this user account?')) return;
                  await suspendReportedUser(detail.reported_user_id);
                  onReload();
                }}
              >
                Suspend user
              </AdminPrimaryButton>
              <AdminPrimaryButton variant="ghost" onClick={() => setDetail(null)}>
                Close
              </AdminPrimaryButton>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-3">
            <StatusPill label={detail.status} tone={reportStatusTone(detail.status)} />
            <p className="text-[15px] font-extrabold text-foreground">{detail.reason}</p>
            <AdminMonoBlock label="Reporter" value={detail.reporter_id} />
            <AdminMonoBlock label="Reported user" value={detail.reported_user_id} />
            {detail.note ? <p className="rounded-xl bg-[#F5F6FA] p-3 text-[14px] font-semibold">{detail.note}</p> : null}
            {snippet ? (
              <div>
                <p className="text-[11px] font-extrabold uppercase text-muted">Related content</p>
                <p className="mt-1 rounded-xl bg-[#F5F6FA] p-3 text-[13px] leading-relaxed">{snippet}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}

export function AdminModerationPanel({ data }: { data: AdminDashboardData }) {
  return (
    <>
      <AdminSectionHeader
        title="Moderation log"
        subtitle="Pipeline scores text, may hide content, and flags high severity for review. Sorted high severity first."
        icon={<IoFlashOutline size={22} className="text-primary" />}
      />
      {data.mods.length === 0 ? (
        <AdminEmptyState title="Log empty" subtitle="No moderation events yet." />
      ) : (
        <ul className="space-y-3">
          {data.mods.map((item) => (
            <ModerationCard key={item.id} item={item} data={data} />
          ))}
        </ul>
      )}
    </>
  );
}

function ModerationCard({ item, data }: { item: DbModerationLog; data: AdminDashboardData }) {
  const author = data.modProfiles[item.user_id];
  const preview =
    item.content_type === 'message'
      ? data.modMessagePreview[item.content_id]
      : item.content_type === 'plan'
        ? data.modPlanTitle[item.content_id]
        : null;

  return (
    <li>
      <AdminListCard>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={item.severity} tone={item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warn' : 'neutral'} />
          <span className="rounded-full bg-[#EDE8FF] px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
            {moderationFlagLabel(item.flag_type)}
          </span>
        </div>
        <p className="mt-2 text-[14px] font-semibold text-muted">{moderationAuditSummary(item)}</p>
        <div className="mt-3 rounded-xl border border-border/80 bg-[#FAFBFF] p-3">
          <p className="text-[12px] font-extrabold uppercase text-muted">{moderationContentLabel(item.content_type)}</p>
          {preview ? (
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-foreground">
              {item.content_type === 'message' ? `“${preview}”` : preview}
            </p>
          ) : (
            <p className="mt-2 text-[13px] font-semibold text-muted">
              Preview not loaded (deleted, RLS, or non-text). Use content id below.
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          {author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE8FF]">
              <IoPersonOutline className="text-primary" />
            </div>
          )}
          <div>
            <p className="font-extrabold text-foreground">{author?.display_name?.trim() || 'Unknown member'}</p>
            <p className="font-mono text-[11px] text-muted">{item.user_id}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 min-[400px]:grid-cols-2">
          <div className="rounded-xl bg-[#F5F6FA] p-2.5">
            <p className="text-[10px] font-extrabold uppercase text-muted">System action</p>
            <p className="text-[13px] font-extrabold">{moderationActionLabel(item.action_taken)}</p>
          </div>
          <div className="rounded-xl bg-[#F5F6FA] p-2.5">
            <p className="text-[10px] font-extrabold uppercase text-muted">Heuristic score</p>
            <p className="text-[13px] font-extrabold">{formatModerationScore(item.ai_score)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyIdsButton
            text={`moderation_log_id=${item.id}\ncontent_id=${item.content_id}\nuser_id=${item.user_id}`}
            label="Copy log, content, and user ids"
          />
          <AdminMetaRow icon={<IoTimeOutline size={14} />}>{new Date(item.created_at).toLocaleString()}</AdminMetaRow>
        </div>
      </AdminListCard>
    </li>
  );
}

export function AdminDisputesPanel({
  data,
  onReload,
}: {
  data: AdminDashboardData;
  onReload: Reload;
}) {
  const [planFilter, setPlanFilter] = useState<'open' | 'all'>('open');
  const [planDetail, setPlanDetail] = useState<DbDispute | null>(null);
  const [planEvidence, setPlanEvidence] = useState<DbDisputeEvidence[]>([]);
  const [planNotes, setPlanNotes] = useState('');
  const [planBusy, setPlanBusy] = useState(false);

  const filteredPlans =
    planFilter === 'all'
      ? data.planDisputes
      : data.planDisputes.filter((x) => x.status === 'pending' || x.status === 'reviewing');

  async function openPlan(row: DbDispute) {
    setPlanDetail(row);
    setPlanNotes(row.internal_notes ?? '');
    setPlanEvidence(await loadPlanDisputeEvidence(row.id));
  }

  async function resolvePlan(status: 'resolved' | 'rejected', resolution: 'refund' | 'partial' | 'none' | null) {
    if (!planDetail) return;
    setPlanBusy(true);
    await resolvePlanDispute(planDetail.id, status, status === 'resolved' ? resolution : null, planNotes);
    setPlanBusy(false);
    setPlanDetail(null);
    onReload();
  }

  return (
    <>
      <AdminSectionHeader
        title="Member plan disputes"
        subtitle="Evidence in private storage — open signed links in the browser; audit is chronological."
        icon={<IoScaleOutline size={22} className="text-primary" />}
      />
      <div className="mb-4 flex gap-2">
        <FilterChip label="Open" active={planFilter === 'open'} onClick={() => setPlanFilter('open')} />
        <FilterChip label="All" active={planFilter === 'all'} onClick={() => setPlanFilter('all')} />
      </div>
      {filteredPlans.length === 0 ? (
        <AdminEmptyState title="Queue clear" subtitle="No plan disputes match this filter." icon={<IoCheckmarkDoneOutline size={40} />} />
      ) : (
        <ul className="mb-10 space-y-3">
          {filteredPlans.map((d) => (
            <li key={d.id}>
              <AdminListCard onClick={() => void openPlan(d)}>
                <p className="font-extrabold text-foreground">{d.category.replace(/_/g, ' ')}</p>
                <StatusPill label={d.status} tone={d.status === 'pending' ? 'warn' : 'primary'} />
                <AdminMetaRow icon={<IoCalendarOutline size={14} />}>Plan {shortUuid(d.plan_id, 12)}</AdminMetaRow>
                <AdminMetaRow icon={<IoTimeOutline size={14} />}>{new Date(d.created_at).toLocaleString()}</AdminMetaRow>
              </AdminListCard>
            </li>
          ))}
        </ul>
      )}

      <div className="my-8 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <AdminSectionHeader
        title="Escrow disputes"
        subtitle="Legacy escrow queue — payment holds and release disputes."
        icon={<IoWalletOutline size={22} className="text-primary" />}
      />
      {data.escrowDisputes.length === 0 ? (
        <AdminEmptyState title="No escrow rows" subtitle="Nothing in this queue right now." icon={<IoWalletOutline size={40} className="text-muted" />} />
      ) : (
        <ul className="space-y-3">
          {data.escrowDisputes.map((row) => (
            <EscrowCard key={row.id} row={row} onResolved={onReload} />
          ))}
        </ul>
      )}

      <AdminModal
        open={!!planDetail}
        onClose={() => setPlanDetail(null)}
        title="Plan dispute"
        kicker="Dispute"
        footer={
          planDetail ? (
            <div className="flex flex-col gap-2">
              <AdminPrimaryButton
                variant="secondary"
                disabled={planBusy}
                onClick={async () => {
                  setPlanBusy(true);
                  await savePlanDisputeNotes(planDetail.id, planNotes);
                  setPlanBusy(false);
                  onReload();
                }}
              >
                Save notes & mark reviewing
              </AdminPrimaryButton>
              <AdminPrimaryButton variant="danger" disabled={planBusy} onClick={() => void resolvePlan('rejected', null)}>
                Reject claim
              </AdminPrimaryButton>
              <AdminPrimaryButton disabled={planBusy} onClick={() => void resolvePlan('resolved', 'refund')}>
                Resolve · full refund
              </AdminPrimaryButton>
              <AdminPrimaryButton variant="secondary" disabled={planBusy} onClick={() => void resolvePlan('resolved', 'partial')}>
                Resolve · partial refund
              </AdminPrimaryButton>
              <AdminPrimaryButton variant="secondary" disabled={planBusy} onClick={() => void resolvePlan('resolved', 'none')}>
                Resolve · no payout
              </AdminPrimaryButton>
            </div>
          ) : null
        }
      >
        {planDetail ? (
          <div className="space-y-3">
            <StatusPill label={planDetail.status} tone="primary" />
            <p className="font-extrabold capitalize">{planDetail.category.replace(/_/g, ' ')}</p>
            <Link href={`/plan/${planDetail.plan_id}`} className="text-[13px] font-extrabold text-primary">
              Open plan →
            </Link>
            <p className="text-[13px] font-semibold text-muted">
              Parties: {shortUuid(planDetail.reporter_id)} → {shortUuid(planDetail.reported_user_id)}
            </p>
            {planDetail.reporter_note ? (
              <p className="rounded-xl bg-[#F5F6FA] p-3 text-[14px] font-semibold">{planDetail.reporter_note}</p>
            ) : null}
            <label className="text-[11px] font-extrabold uppercase text-muted">Internal notes</label>
            <textarea
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-border px-3 py-2 text-[14px]"
              placeholder="Visible to admins only"
            />
            {planEvidence.length > 0 ? (
              <ul className="space-y-2">
                {planEvidence.map((ev) => (
                  <li key={ev.id} className="rounded-xl border border-border p-3 text-[13px]">
                    <p className="font-extrabold">{ev.type.replace(/_/g, ' ')}</p>
                    <p className="text-muted">{new Date(ev.created_at).toLocaleString()}</p>
                    {ev.type === 'text' && ev.text_body ? <p className="mt-1">{ev.text_body}</p> : null}
                    {ev.file_path ? (
                      <button
                        type="button"
                        className="mt-2 font-extrabold text-primary"
                        onClick={async () => {
                          const url = await getDisputeEvidenceSignedUrl(ev.file_path!);
                          if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        Open signed file (1h)
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}

function EscrowCard({ row, onResolved }: { row: EscrowDisputeRow; onResolved: Reload }) {
  const [busy, setBusy] = useState(false);
  const esc = row.escrow_row;
  const amt = formatEscrowAmount(esc?.amount_cents, esc?.currency);
  const canResolve = row.status.toLowerCase() !== 'resolved' && row.status.toLowerCase() !== 'dismissed';

  return (
    <AdminListCard>
      <div className="rounded-2xl bg-gradient-to-br from-primary/[0.07] via-secondary/[0.05] to-emerald-500/[0.06] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Reason</p>
            <p className="text-[16px] font-extrabold text-foreground">{row.reason}</p>
          </div>
          <StatusPill label={row.status} tone={escrowStatusTone(row.status)} />
        </div>
        {row.detail ? <p className="mt-3 rounded-xl bg-white/90 p-3 text-[13px] font-semibold text-muted">{row.detail}</p> : null}
        <div className="mt-3 grid gap-2 text-[12px] font-semibold text-muted min-[400px]:grid-cols-2">
          <p>Opened {new Date(row.created_at).toLocaleString()}</p>
          {esc ? (
            <>
              <p>Escrow {shortUuid(esc.id, 12)}</p>
              {amt ? <p className="font-extrabold text-foreground">Held {amt}</p> : null}
              {esc.plan_id ? (
                <Link href={`/plan/${esc.plan_id}`} className="font-extrabold text-primary">
                  Open plan
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
        {canResolve ? (
          <AdminPrimaryButton
            className="mt-4 w-full"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await resolveEscrowDispute(row.id);
              setBusy(false);
              onResolved();
            }}
          >
            {busy ? 'Saving…' : 'Mark resolved'}
          </AdminPrimaryButton>
        ) : null}
      </div>
    </AdminListCard>
  );
}

export function AdminSupportPanel({ data, onReload }: { data: AdminDashboardData; onReload: Reload }) {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [detail, setDetail] = useState<DbSupportTicket | null>(null);

  const tickets = [...data.tickets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((x) => {
      if (filter === 'all') return true;
      const s = x.status.toLowerCase();
      return s === 'open' || s === 'in_progress';
    });

  return (
    <>
      <AdminSectionHeader
        title="Support inbox"
        subtitle="Member tickets — update status and priority from detail."
        icon={<IoChatbubblesOutline size={22} className="text-primary" />}
      />
      <div className="mb-4 flex gap-2">
        <FilterChip label="Open" active={filter === 'open'} onClick={() => setFilter('open')} />
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
      </div>
      {tickets.length === 0 ? (
        <AdminEmptyState title="Inbox clear" subtitle="No tickets match this filter." />
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <AdminListCard onClick={() => setDetail(t)}>
                <p className="font-extrabold text-foreground">{t.subject?.trim() || '(No subject)'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill label={t.status} tone={ticketStatusTone(t.status)} />
                  <StatusPill label={t.priority} tone={ticketPriorityTone(t.priority)} />
                </div>
                <AdminMetaRow icon={<IoTimeOutline size={14} />}>{new Date(t.created_at).toLocaleString()}</AdminMetaRow>
              </AdminListCard>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.subject?.trim() || 'Support ticket'}
        kicker="Support"
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              {(['in_progress', 'resolved'] as const).map((s) => (
                <AdminPrimaryButton
                  key={s}
                  variant={s === 'resolved' ? 'primary' : 'secondary'}
                  onClick={async () => {
                    await updateSupportTicket(detail.id, { status: s });
                    setDetail(null);
                    onReload();
                  }}
                >
                  Mark {s.replace(/_/g, ' ')}
                </AdminPrimaryButton>
              ))}
              <AdminPrimaryButton variant="ghost" onClick={() => setDetail(null)}>
                Close
              </AdminPrimaryButton>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={detail.status} tone={ticketStatusTone(detail.status)} />
              <StatusPill label={detail.priority} tone={ticketPriorityTone(detail.priority)} />
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-[#F5F6FA] p-4 text-[14px] font-semibold leading-relaxed">
              {detail.body?.trim() || '(Empty message)'}
            </p>
            {detail.user_id ? (
              <div className="flex items-center justify-between gap-2">
                <AdminMonoBlock label="Member id" value={detail.user_id} />
                <CopyIdsButton text={detail.user_id} label="Copy member id" />
              </div>
            ) : null}
            <AdminMetaRow icon={<IoTimeOutline size={14} />}>
              {new Date(detail.created_at).toLocaleString()}
            </AdminMetaRow>
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}

export function AdminUsersSection() {
  return (
    <>
      <AdminSectionHeader
        title="Members"
        subtitle="Search, edit account status, verification, boosts, and profile fields."
        icon={<IoPeopleOutline size={22} className="text-primary" />}
      />
      <AdminUsersPanel />
    </>
  );
}

export function AdminPlansSection() {
  return (
    <>
      <AdminSectionHeader
        title="Plans directory"
        subtitle="Mood TTL, suppression, archive, and deep links — pair with Reports for context."
        icon={<IoAlbumsOutline size={22} className="text-primary" />}
      />
      <AdminPlansPanel />
    </>
  );
}
