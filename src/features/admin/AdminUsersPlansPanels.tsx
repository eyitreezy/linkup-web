'use client';

import { AdminGoodwillPanel } from '@/components/admin/AdminGoodwillPanel';
import { AdminTrialPanel } from '@/components/admin/AdminTrialPanel';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import {
  AdminListCard,
  AdminModal,
  AdminPrimaryButton,
  AdminSearchInput,
  FilterChip,
  StatusPill,
} from '@/features/admin/adminUi';
import {
  archiveAdminPlan,
  deleteAdminPlan,
  isPlanExpired,
  loadAdminPlans,
  loadAdminUsers,
  oneProfile,
  saveAdminUserEdits,
  suspendAdminUser,
  togglePlanSuppress,
  unarchiveAdminPlan,
  type AdminUserListRow,
} from '@/services/admin.service';
import type { AccountStatus, DbPlan, UserVerification } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ACCOUNTS: AccountStatus[] = ['active', 'restricted', 'suspended', 'banned'];
const VERIFS: UserVerification[] = ['unverified', 'pending', 'verified', 'rejected'];

export function AdminUsersPanel() {
  const [rows, setRows] = useState<AdminUserListRow[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [accFlt, setAccFlt] = useState<'all' | AccountStatus | 'non_active'>('all');
  const [verFlt, setVerFlt] = useState<'all' | 'verified' | 'unverified'>('all');
  const [edit, setEdit] = useState<AdminUserListRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await loadAdminUsers();
    setRows(res.rows);
    setAdminIds(res.adminIds);
    setErr(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...rows];
    if (needle) {
      list = list.filter((u) => {
        const pr = oneProfile(u.profiles);
        const blob = [u.email, u.id, pr?.display_name, pr?.bio].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(needle);
      });
    }
    if (accFlt !== 'all') {
      list = list.filter((u) => (accFlt === 'non_active' ? u.account_status !== 'active' : u.account_status === accFlt));
    }
    if (verFlt === 'verified') list = list.filter((u) => u.verification_status === 'verified');
    if (verFlt === 'unverified') list = list.filter((u) => u.verification_status !== 'verified');
    return list;
  }, [rows, q, accFlt, verFlt]);

  return (
    <div className="min-w-0 space-y-4">
      <AdminSearchInput value={q} onChange={setQ} placeholder="Search…" />
      <div className="flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 scrollbar-none min-[400px]:flex-wrap min-[400px]:overflow-visible min-[400px]:gap-2">
        {(['all', 'active', 'restricted', 'suspended', 'banned', 'non_active'] as const).map((k) => (
          <FilterChip key={k} label={k === 'non_active' ? 'Non-active' : k} active={accFlt === k} onClick={() => setAccFlt(k)} />
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5 min-[400px]:gap-2">
        {(['all', 'verified', 'unverified'] as const).map((k) => (
          <FilterChip key={k} label={k} active={verFlt === k} onClick={() => setVerFlt(k)} />
        ))}
      </div>
      {err ? <p className="text-[13px] font-semibold text-[#EF4444]">{err}</p> : null}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : (
        <ul className="space-y-3">
          {filtered.map((u) => {
            const pr = oneProfile(u.profiles);
            return (
              <li key={u.id}>
                <AdminListCard>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-foreground">{pr?.display_name ?? u.email ?? u.id}</p>
                      <p className="text-[12px] font-semibold text-muted">{u.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusPill label={u.account_status} tone={u.account_status === 'active' ? 'ok' : 'danger'} />
                        <StatusPill label={u.verification_status} tone={u.verification_status === 'verified' ? 'ok' : 'warn'} />
                        {adminIds.has(u.id) ? <StatusPill label="admin" tone="primary" /> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEdit(u)}
                      className="rounded-full border border-primary/25 px-3 py-1.5 text-[12px] font-extrabold text-primary"
                    >
                      Edit
                    </button>
                  </div>
                </AdminListCard>
              </li>
            );
          })}
        </ul>
      )}
      {edit ? (
        <UserEditModal
          user={edit}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={async (patch) => {
            setBusy(true);
            const { error } = await saveAdminUserEdits(edit.id, patch, oneProfile(edit.profiles));
            setBusy(false);
            if (error) setErr(error);
            else {
              setEdit(null);
              void load();
            }
          }}
          onSuspend={async () => {
            setBusy(true);
            const { error } = await suspendAdminUser(edit.id);
            setBusy(false);
            if (error) setErr(error.message ?? 'Could not suspend user');
            else {
              setEdit(null);
              void load();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function UserEditModal({
  user,
  busy,
  onClose,
  onSave,
  onSuspend,
}: {
  user: AdminUserListRow;
  busy: boolean;
  onClose: () => void;
  onSave: (p: {
    account_status: AccountStatus;
    verification_status: UserVerification;
    boost_credits: number;
    display_name: string;
    bio: string;
    verified_badge: boolean;
    is_profile_public: boolean;
  }) => Promise<void>;
  onSuspend: () => Promise<void>;
}) {
  const pr = oneProfile(user.profiles);
  const [accountStatus, setAccountStatus] = useState(user.account_status);
  const [verificationStatus, setVerificationStatus] = useState(user.verification_status);
  const [boostCredits, setBoostCredits] = useState(String(user.boost_credits ?? 0));
  const [displayName, setDisplayName] = useState(pr?.display_name ?? '');
  const [bio, setBio] = useState(pr?.bio ?? '');
  const [verifiedBadge, setVerifiedBadge] = useState(!!pr?.verified_badge);
  const [isPublic, setIsPublic] = useState(pr?.is_profile_public !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-1.5 min-[360px]:p-2 min-[400px]:items-center min-[400px]:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-white p-4 shadow-xl min-[400px]:rounded-3xl min-[400px]:p-5">
        <h3 className="font-display text-xl font-extrabold">Edit member</h3>
        <p className="mt-1 text-[13px] font-semibold text-muted">{user.email}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-extrabold text-muted">Account status</label>
          <select
            value={accountStatus}
            onChange={(e) => setAccountStatus(e.target.value as AccountStatus)}
            className="w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
          >
            {ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="block text-[12px] font-extrabold text-muted">Verification</label>
          <select
            value={verificationStatus}
            onChange={(e) => setVerificationStatus(e.target.value as UserVerification)}
            className="w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
          >
            {VERIFS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={boostCredits}
            onChange={(e) => setBoostCredits(e.target.value)}
            type="number"
            className="w-full rounded-xl border border-border px-3 py-2 text-[14px]"
            placeholder="Boost credits"
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-[14px]"
            placeholder="Display name"
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-border px-3 py-2 text-[14px]"
            placeholder="Bio"
          />
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={verifiedBadge} onChange={(e) => setVerifiedBadge(e.target.checked)} />
            Verified badge
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public profile
          </label>
          <AdminGoodwillPanel userId={user.id} />
          <AdminTrialPanel userId={user.id} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSave({
                account_status: accountStatus,
                verification_status: verificationStatus,
                boost_credits: Number(boostCredits) || 0,
                display_name: displayName,
                bio,
                verified_badge: verifiedBadge,
                is_profile_public: isPublic,
              })
            }
            className="flex-1 rounded-full linkup-gradient-primary py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSuspend()}
            className="rounded-full border border-red-300 px-4 py-2.5 text-[13px] font-extrabold text-red-600"
          >
            Suspend
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2.5 text-[13px] font-extrabold text-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPlansPanel() {
  const [rows, setRows] = useState<DbPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState<'all' | 'mood' | 'expired' | 'suppressed'>('all');
  const [dialog, setDialog] = useState<{ action: 'archive' | 'delete'; id: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadAdminPlans();
    if (error) setErr(error.message);
    else setErr(null);
    setRows((data ?? []) as DbPlan[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (needle) {
        const blob = `${p.title} ${p.description ?? ''} ${p.location_label ?? ''}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      const exp = isPlanExpired(p);
      if (flt === 'mood' && !p.is_mood_plan) return false;
      if (flt === 'expired' && !exp) return false;
      if (flt === 'suppressed' && !p.is_suppressed) return false;
      return true;
    });
  }, [rows, q, flt]);

  return (
    <div className="min-w-0 space-y-4">
      <AdminSearchInput value={q} onChange={setQ} placeholder="Search…" />
      <div className="flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 scrollbar-none min-[400px]:flex-wrap min-[400px]:overflow-visible min-[400px]:gap-2">
        {(['all', 'mood', 'expired', 'suppressed'] as const).map((k) => (
          <FilterChip
            key={k}
            label={k === 'suppressed' ? 'Hidden' : k.charAt(0).toUpperCase() + k.slice(1)}
            active={flt === k}
            onClick={() => setFlt(k)}
          />
        ))}
      </div>
      {err ? <p className="text-[13px] font-semibold text-[#EF4444]">{err}</p> : null}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const expired = isPlanExpired(p);
            return (
              <li key={p.id}>
                <AdminListCard>
                  <Link href={`/plan/${p.id}`} className="font-extrabold text-foreground hover:text-primary">
                    {p.title}
                  </Link>
                  <p className="mt-1 text-[12px] font-semibold text-muted">
                    {p.status}
                    {p.is_mood_plan ? ' · mood' : ''}
                    {p.archived_at ? ' · archived' : ''}
                    {p.is_suppressed ? ' · hidden' : ''}
                    {expired ? ' · expired' : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.archived_at ? (
                      <button
                        type="button"
                        onClick={() => void unarchiveAdminPlan(p.id).then(() => load())}
                        className="rounded-full border border-border px-3 py-1 text-[11px] font-extrabold"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDialog({ action: 'archive', id: p.id })}
                        className="rounded-full border border-border px-3 py-1 text-[11px] font-extrabold"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void togglePlanSuppress(p.id, !p.is_suppressed).then(() => load())}
                      className="rounded-full border border-border px-3 py-1 text-[11px] font-extrabold"
                    >
                      {p.is_suppressed ? 'Unhide' : 'Hide'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ action: 'delete', id: p.id })}
                      className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-extrabold text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </AdminListCard>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!dialog}
        title={dialog?.action === 'delete' ? 'Permanently delete plan?' : 'Archive this plan?'}
        message={
          dialog?.action === 'delete'
            ? 'This cannot be undone and may cascade related data.'
            : 'Hides from discovery; you can restore from this panel.'
        }
        cancelLabel="Cancel"
        confirmLabel={dialog?.action === 'delete' ? 'Delete' : 'Archive'}
        confirmVariant={dialog?.action === 'delete' ? 'danger' : 'neutral'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (!dialog) return;
          if (dialog.action === 'delete') await deleteAdminPlan(dialog.id);
          else await archiveAdminPlan(dialog.id);
          setDialog(null);
          void load();
        }}
      />
    </div>
  );
}
