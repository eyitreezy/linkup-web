'use client';

import { ToggleRow } from '@/components/settings/ToggleRow';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import {
  AdminListCard,
  AdminModal,
  AdminPrimaryButton,
  AdminSearchInput,
  AdminSectionHeader,
  FilterChip,
  StatusPill,
} from '@/features/admin/adminUi';
import { subscribeAdminMeetTypesRealtime } from '@/lib/plans/subscribeMeetTypesRealtime';
import { invalidateMeetTypeQueries } from '@/lib/plans/invalidateMeetTypeQueries';
import { createClient } from '@/lib/supabase/client';
import {
  adminApproveMeetType,
  adminRejectMeetType,
  createAdminMeetType,
  deleteAdminMeetType,
  fetchAllMeetTypesAdmin,
  fetchMeetTypeCreatorLabels,
  isAdminCatalogMeetType,
  isUserCreatedMeetType,
  meetTypeOriginLabel,
  setAdminMeetTypeActive,
  updateAdminMeetType,
  type AdminMeetTypeInput,
} from '@/services/adminMeetTypes.service';
import { countPlansUsingMeetType } from '@/services/meetTypes.service';
import type { DbMeetType } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoAddCircleOutline, IoCheckmark, IoClose, IoGridOutline, IoPencil, IoTrashOutline } from 'react-icons/io5';

const DURATIONS = [
  { m: 60, label: '1h' },
  { m: 90, label: '1.5h' },
  { m: 120, label: '2h' },
  { m: 180, label: '3h' },
] as const;

type ActiveFilter = 'all' | 'active' | 'inactive';

function toFormInput(type: DbMeetType | null): AdminMeetTypeInput {
  if (!type) {
    return {
      name: '',
      slug: '',
      description: '',
      meetTypeImages: '',
      defaultDurationMinutes: 120,
      isActive: true,
      supportsMood: false,
      isRestricted: false,
    };
  }
  return {
    name: type.name,
    slug: type.slug,
    description: type.description ?? '',
    meetTypeImages: type.meet_type_images ?? '',
    defaultDurationMinutes: type.default_duration_minutes,
    isActive: type.is_active,
    supportsMood: type.supports_mood,
    isRestricted: type.is_restricted,
  };
}

export function AdminMeetTypesPanel() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<DbMeetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DbMeetType | null>(null);
  const [form, setForm] = useState<AdminMeetTypeInput>(() => toFormInput(null));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbMeetType | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [creatorLabels, setCreatorLabels] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<DbMeetType | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setErr(null);
    const client = createClient();
    const { rows: data, error } = await fetchAllMeetTypesAdmin(client);
    if (error) {
      setErr(error);
      setRows([]);
      setCreatorLabels({});
      if (!options?.silent) setLoading(false);
      return;
    }
    setRows(data);
    const creatorIds = data
      .filter((t) => t.created_by && (isUserCreatedMeetType(t) || t.approval_status === 'pending'))
      .map((t) => t.created_by!);
    const labels = await fetchMeetTypeCreatorLabels(client, creatorIds);
    setCreatorLabels(labels);
    if (!options?.silent) setLoading(false);
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeAdminMeetTypesRealtime(() => {
      void loadRef.current({ silent: true });
    });
  }, []);

  const invalidateMeetTypeQueriesForClients = useCallback(async () => {
    await invalidateMeetTypeQueries(queryClient);
  }, [queryClient]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...rows];
    if (activeFilter === 'active') list = list.filter((t) => t.is_active);
    if (activeFilter === 'inactive') list = list.filter((t) => !t.is_active);
    if (needle) {
      list = list.filter((t) => {
        const creator =
          t.created_by && isUserCreatedMeetType(t) ? creatorLabels[t.created_by] : null;
        return [t.name, t.slug, t.description, meetTypeOriginLabel(t), creator].some((v) =>
          (v ?? '').toLowerCase().includes(needle)
        );
      });
    }
    return list;
  }, [rows, q, activeFilter, creatorLabels]);

  const pendingUserTypes = useMemo(
    () => rows.filter((t) => t.created_by && t.approval_status === 'pending'),
    [rows]
  );

  const adminCatalogTypes = useMemo(
    () => filtered.filter(isAdminCatalogMeetType),
    [filtered]
  );
  const userCreatedTypes = useMemo(
    () => filtered.filter(isUserCreatedMeetType).filter((t) => t.approval_status !== 'pending'),
    [filtered]
  );

  function openCreate() {
    setEditing(null);
    setForm(toFormInput(null));
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(type: DbMeetType) {
    setEditing(type);
    setForm(toFormInput(type));
    setFormError(null);
    setModalOpen(true);
    void (async () => {
      const { count } = await countPlansUsingMeetType(createClient(), type.id);
      setPlanCounts((prev) => ({ ...prev, [type.id]: count }));
    })();
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSave() {
    setBusy(true);
    setFormError(null);
    const client = createClient();
    const result = editing
      ? await updateAdminMeetType(client, editing.id, form)
      : await createAdminMeetType(client, form);
    setBusy(false);
    if (result.error || !result.row) {
      setFormError(result.error ?? 'Could not save meet type.');
      return;
    }
    closeModal();
    await load();
    await invalidateMeetTypeQueriesForClients();
  }

  async function handleArchive(type: DbMeetType) {
    setBusy(true);
    const { error } = await setAdminMeetTypeActive(createClient(), type.id, false);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    await load();
    await invalidateMeetTypeQueriesForClients();
  }

  async function handleActivate(type: DbMeetType) {
    setBusy(true);
    const { error } = await setAdminMeetTypeActive(createClient(), type.id, true);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    await load();
    await invalidateMeetTypeQueriesForClients();
  }

  async function handleApprove(type: DbMeetType) {
    setApprovalBusyId(type.id);
    setErr(null);
    const result = await adminApproveMeetType(createClient(), type);
    setApprovalBusyId(null);
    if (result.error) {
      setErr(result.error);
      return;
    }
    await load();
    await invalidateMeetTypeQueriesForClients();
  }

  async function handleRejectConfirm(type: DbMeetType, reason: string) {
    setRejectBusy(true);
    setErr(null);
    const result = await adminRejectMeetType(createClient(), type, reason.trim() || null);
    setRejectBusy(false);
    if (result.error) {
      setErr(result.error);
      return;
    }
    setRejectTarget(null);
    setRejectReason('');
    await load();
    await invalidateMeetTypeQueriesForClients();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    if (planCounts[deleteTarget.id] != null && planCounts[deleteTarget.id] > 0) {
      setDeleteTarget(null);
      setErr(`"${deleteTarget.name}" is used on plans. Archive it instead.`);
      return;
    }
    setDeleteBusy(true);
    const result = await deleteAdminMeetType(createClient(), deleteTarget.id);
    setDeleteBusy(false);
    if (result.error) {
      setDeleteTarget(null);
      setErr(result.error);
      return;
    }
    setDeleteTarget(null);
    await load();
    await invalidateMeetTypeQueriesForClients();
  }

  function renderPendingRow(type: DbMeetType) {
    const creatorName = type.created_by ? creatorLabels[type.created_by] ?? 'Unknown member' : 'Unknown member';
    const rowBusy = approvalBusyId === type.id;

    return (
      <AdminListCard key={type.id}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-foreground">{type.name}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-muted">
              by <span className="font-extrabold text-foreground">{creatorName}</span>
            </p>
            {type.description ? (
              <p className="mt-1 line-clamp-2 text-[12px] font-semibold text-muted">{type.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={rowBusy || rejectBusy}
              onClick={() => void handleApprove(type)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <IoCheckmark size={13} />
              {rowBusy ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={rowBusy || rejectBusy}
              onClick={() => {
                setRejectReason('');
                setRejectTarget(type);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <IoClose size={13} />
              Reject
            </button>
          </div>
        </div>
      </AdminListCard>
    );
  }

  function renderMeetTypeRow(type: DbMeetType) {
    const creatorName =
      type.created_by && isUserCreatedMeetType(type) ? creatorLabels[type.created_by] : null;

    return (
      <li key={type.id}>
        <AdminListCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {creatorName ? (
                <p className="text-[12px] font-semibold text-muted">
                  Created by{' '}
                  <span className="font-extrabold text-foreground">{creatorName}</span>
                </p>
              ) : null}
              <p className={cn('font-extrabold text-foreground', creatorName && 'mt-1')}>{type.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{type.slug}</p>
              {type.description ? (
                <p className="mt-1 line-clamp-2 text-[12px] font-semibold text-muted">{type.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill
                  label={type.is_active ? 'Active' : 'Inactive'}
                  tone={type.is_active ? 'ok' : 'neutral'}
                />
                <StatusPill label={meetTypeOriginLabel(type)} tone="primary" />
                {type.supports_mood ? <StatusPill label="Mood" tone="warn" /> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => openEdit(type)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-extrabold text-primary hover:bg-[#F5F6FA]"
              >
                <IoPencil size={13} />
                Edit
              </button>
              {type.is_active ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleArchive(type)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-extrabold text-muted hover:bg-[#F5F6FA] disabled:opacity-50"
                >
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleActivate(type)}
                  className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  Activate
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(type);
                  void (async () => {
                    const { count } = await countPlansUsingMeetType(createClient(), type.id);
                    setPlanCounts((prev) => ({ ...prev, [type.id]: count }));
                  })();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-extrabold text-red-600 hover:bg-red-50"
              >
                <IoTrashOutline size={13} />
                Delete
              </button>
            </div>
          </div>
        </AdminListCard>
      </li>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminSectionHeader
        title="Meet types"
        subtitle="Create and manage catalog meet types. Archive types in use; delete only when unused."
        icon={<IoGridOutline size={22} className="text-primary" />}
        action={
          <AdminPrimaryButton
            onClick={openCreate}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 min-[400px]:w-auto"
          >
            <IoAddCircleOutline size={18} aria-hidden />
            New meet type
          </AdminPrimaryButton>
        }
      />

      <AdminSearchInput value={q} onChange={setQ} placeholder="Search meet types…" />

      <div className="flex flex-wrap gap-1.5 min-[400px]:gap-2">
        {(['all', 'active', 'inactive'] as const).map((k) => (
          <FilterChip
            key={k}
            label={k === 'all' ? 'All' : k === 'active' ? 'Active' : 'Inactive'}
            active={activeFilter === k}
            onClick={() => setActiveFilter(k)}
          />
        ))}
      </div>

      {err ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="h-32 animate-pulse rounded-[22px] bg-[#EDE8FF]/70" />
      ) : (
        <div className="space-y-6">
          {pendingUserTypes.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
                  Pending approval
                </h3>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                  {pendingUserTypes.length}
                </span>
              </div>
              <ul className="space-y-3">{pendingUserTypes.map(renderPendingRow)}</ul>
            </section>
          ) : null}

          {filtered.length === 0 && pendingUserTypes.length === 0 ? (
            <p className="text-[14px] font-semibold text-muted">No meet types match this filter.</p>
          ) : null}

          {adminCatalogTypes.length > 0 ? (
            <section>
              <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
                Admin & catalog
              </h3>
              <ul className="space-y-3">{adminCatalogTypes.map(renderMeetTypeRow)}</ul>
            </section>
          ) : null}
          {userCreatedTypes.length > 0 ? (
            <section>
              <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
                User-created
              </h3>
              <ul className="space-y-3">{userCreatedTypes.map(renderMeetTypeRow)}</ul>
            </section>
          ) : null}
        </div>
      )}

      <AdminModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit meet type' : 'New meet type'}
        kicker="Meet types"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <AdminPrimaryButton variant="ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </AdminPrimaryButton>
            <AdminPrimaryButton onClick={() => void handleSave()} disabled={busy || !form.name.trim()}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create meet type'}
            </AdminPrimaryButton>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase text-muted">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[14px] font-semibold outline-none focus:border-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase text-muted">Slug</span>
            <input
              value={form.slug ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder={editing ? undefined : 'Auto-generated if empty'}
              className="mt-1 w-full rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 font-mono text-[13px] outline-none focus:border-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase text-muted">Description</span>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[13px] font-semibold outline-none focus:border-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase text-muted">Cover image URL</span>
            <input
              value={form.meetTypeImages ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, meetTypeImages: e.target.value }))}
              placeholder="https://…/meet-type-images/…"
              className="mt-1 w-full rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[13px] font-semibold outline-none focus:border-primary/40"
            />
          </label>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-muted">Default duration</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, defaultDurationMinutes: d.m }))}
                  className={
                    form.defaultDurationMinutes === d.m
                      ? 'rounded-full linkup-gradient-primary px-3 py-1.5 text-[12px] font-extrabold text-white'
                      : 'rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-extrabold text-primary'
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow
            label="Active in app"
            checked={form.isActive}
            onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
          />
          <ToggleRow
            label="Supports mood plans"
            checked={form.supportsMood}
            onChange={(checked) => setForm((f) => ({ ...f, supportsMood: checked }))}
          />
          <ToggleRow
            label="Restricted (tier gates)"
            checked={form.isRestricted}
            onChange={(checked) => setForm((f) => ({ ...f, isRestricted: checked }))}
          />
          {editing && planCounts[editing.id] != null ? (
            <p className="text-[12px] font-semibold text-muted">
              Used on {planCounts[editing.id]} plan{planCounts[editing.id] === 1 ? '' : 's'}. Archive instead of
              delete when in use.
            </p>
          ) : null}
          {formError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">
              {formError}
            </p>
          ) : null}
        </div>
      </AdminModal>

      {rejectTarget ? (
        <AdminModal
          open
          onClose={() => {
            if (rejectBusy) return;
            setRejectTarget(null);
            setRejectReason('');
          }}
          title={`Reject "${rejectTarget.name}"?`}
          kicker="Meet types"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <AdminPrimaryButton
                variant="ghost"
                disabled={rejectBusy}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </AdminPrimaryButton>
              <AdminPrimaryButton
                variant="danger"
                disabled={rejectBusy}
                onClick={() => void handleRejectConfirm(rejectTarget, rejectReason)}
              >
                {rejectBusy ? 'Rejecting…' : 'Reject'}
              </AdminPrimaryButton>
            </div>
          }
        >
          <p className="text-[13px] font-semibold text-muted">
            You can provide a reason to send to the member (optional).
          </p>
          <input
            type="text"
            placeholder="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="mt-3 w-full rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[14px] font-semibold outline-none focus:border-primary/40"
          />
        </AdminModal>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete meet type?"
        message={
          deleteTarget
            ? planCounts[deleteTarget.id] != null && planCounts[deleteTarget.id] > 0
              ? `This type is used on ${planCounts[deleteTarget.id]} plan(s). Archive it instead.`
              : `Permanently delete "${deleteTarget.name}"? This cannot be undone.`
            : ''
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
