'use client';

import { MeetTypeReviewPendingModal } from '@/components/plans/MeetTypeReviewPendingModal';
import { MeetTypeIcon } from '@/components/plans/MeetTypeIcon';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useMeetTypesRealtime } from '@/hooks/useMeetTypesRealtime';
import {
  canUserManageMeetType,
  isPendingMeetType,
  selectableMeetTypes,
} from '@/lib/plans/meetTypes';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { createClient } from '@/lib/supabase/client';
import {
  createUserMeetType,
  deleteUserMeetType,
  fetchMeetTypesForUser,
  invokeMeetTypeEmail,
  updateUserMeetType,
} from '@/services/meetTypes.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { IoAddCircleOutline, IoClose, IoPencil, IoTrashOutline } from 'react-icons/io5';

const DURATIONS = [
  { m: 60, label: '1h' },
  { m: 90, label: '1.5h' },
  { m: 120, label: '2h' },
  { m: 180, label: '3h' },
] as const;

type Props = {
  meetTypeId: string | null;
  onSelect: (mt: DbMeetType) => void;
};

export function MeetTypeSelectorSection({ meetTypeId, onSelect }: Props) {
  const user = useAuthStore((s) => s.user);
  const { isAdmin } = useAdminAccess();
  useMeetTypesRealtime(user?.id);
  const queryClient = useQueryClient();
  const runGated = useGatedAction();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<DbMeetType | null>(null);
  const [formName, setFormName] = useState('');
  const [formDuration, setFormDuration] = useState(120);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbMeetType | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalMode, setReviewModalMode] = useState<'submitted' | 'pending'>('pending');
  const [reviewModalType, setReviewModalType] = useState<DbMeetType | null>(null);

  const { data: meetTypes, isLoading } = useQuery({
    queryKey: ['meet-types', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { rows, error } = await fetchMeetTypesForUser(createClient(), user.id);
      if (error) throw new Error(error);
      return rows;
    },
    enabled: !!user?.id,
  });

  const previewIcon = inferMeetTypeIcon(formName);
  const isEditMode = editingType !== null;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!meetTypes?.length || !user?.id) return;
    const selectable = selectableMeetTypes(meetTypes, user.id);
    if (!selectable.length) return;

    const current = meetTypeId ? meetTypes.find((t) => t.id === meetTypeId) : null;
    if (current && isPendingMeetType(current, user.id)) {
      const fallback = selectable.find((t) => t.slug === 'dinner') ?? selectable[0];
      onSelectRef.current(fallback);
      return;
    }

    if (!meetTypeId) {
      const dinner = selectable.find((t) => t.slug === 'dinner') ?? selectable[0];
      onSelectRef.current(dinner);
    }
  }, [meetTypes, meetTypeId, user?.id]);

  function openCreateModal() {
    setEditingType(null);
    setFormName('');
    setFormDuration(120);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(mt: DbMeetType) {
    setEditingType(mt);
    setFormName(mt.name);
    setFormDuration(mt.default_duration_minutes);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingType(null);
    setFormError(null);
  }

  function handleSelect(mt: DbMeetType) {
    if (isPendingMeetType(mt, user?.id)) {
      setReviewModalType(mt);
      setReviewModalMode('pending');
      setReviewModalOpen(true);
      return;
    }
    if (mt.slug === 'group' && user?.id) {
      void runGated('group_plan.host', () => onSelect(mt));
      return;
    }
    onSelect(mt);
  }

  async function refreshMeetTypes() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['meet-types', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['meetr-meet-types', user?.id] }),
    ]);
  }

  async function handleSave() {
    if (!user?.id) return;
    setFormBusy(true);
    setFormError(null);

    if (isEditMode && editingType) {
      const { row, error } = await updateUserMeetType(createClient(), user.id, editingType.id, {
        name: formName,
        defaultDurationMinutes: formDuration,
      });
      setFormBusy(false);
      if (error || !row) {
        setFormError(error ?? 'Could not update meet type.');
        return;
      }
      closeModal();
      await refreshMeetTypes();
      if (meetTypeId === row.id) onSelect(row);
      return;
    }

    const { row, error } = await createUserMeetType(createClient(), user.id, {
      name: formName,
      defaultDurationMinutes: formDuration,
    });
    setFormBusy(false);
    if (error || !row) {
      setFormError(error ?? 'Could not create meet type.');
      return;
    }
    closeModal();
    await refreshMeetTypes();
    void invokeMeetTypeEmail(createClient(), {
      type: 'meet_type_submitted',
      meetTypeId: row.id,
      meetTypeName: row.name,
      creatorId: user.id,
    });
    setReviewModalType(row);
    setReviewModalMode('submitted');
    setReviewModalOpen(true);
  }

  async function handleConfirmDelete() {
    if (!user?.id || !deleteTarget) return;
    setDeleteBusy(true);
    const result = await deleteUserMeetType(createClient(), user.id, deleteTarget.id);
    setDeleteBusy(false);

    if (result.error) {
      setDeleteTarget(null);
      if ('blockedByPlans' in result && result.blockedByPlans) {
        setDeleteBlockedMsg(result.error);
      } else {
        setDeleteBlockedMsg(result.error);
      }
      return;
    }

    const deletedId = deleteTarget.id;
    setDeleteTarget(null);
    await refreshMeetTypes();
    if (!user?.id) return;
    const { rows } = await fetchMeetTypesForUser(createClient(), user.id);
    const selectable = selectableMeetTypes(rows, user.id);
    if (meetTypeId === deletedId) {
      const fallback = selectable.find((t) => t.slug === 'dinner') ?? selectable[0];
      if (fallback) onSelect(fallback);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Meet type</p>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          Pick a vibe or add your own — edit or remove custom types with the icons on each chip.
        </p>
      </div>

      {isLoading ? (
        <div className="h-10 animate-pulse rounded-2xl bg-[#EDE8FF]/60" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {(meetTypes ?? []).map((mt) => {
            const selected = meetTypeId === mt.id;
            const pending = isPendingMeetType(mt, user?.id);
            const custom = canUserManageMeetType(mt, user?.id) && !pending;
            return (
              <div
                key={mt.id}
                className={cn(
                  'inline-flex items-center overflow-hidden rounded-full transition',
                  selected
                    ? 'linkup-gradient-primary shadow-sm'
                    : 'border border-border bg-white hover:border-primary/30',
                  custom && !selected && 'border-dashed border-primary/35 bg-[#EDE8FF]/30',
                  pending && 'cursor-not-allowed opacity-45'
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(mt)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-[13px] font-extrabold',
                    selected ? 'text-white' : 'text-foreground',
                    pending && 'cursor-not-allowed'
                  )}
                >
                  <MeetTypeIcon icon={mt.icon} selected={selected} size={15} />
                  {mt.name}
                  {pending ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                        selected ? 'bg-white/25 text-white' : 'bg-amber-500/15 text-amber-900'
                      )}
                    >
                      Pending
                    </span>
                  ) : null}
                </button>
                {custom && !isAdmin ? (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 border-l pr-1.5 pl-0.5',
                      selected ? 'border-white/25' : 'border-primary/15'
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(mt);
                      }}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full transition',
                        selected
                          ? 'text-white/90 hover:bg-white/20'
                          : 'text-primary hover:bg-primary/10'
                      )}
                      aria-label={`Edit ${mt.name}`}
                    >
                      <IoPencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(mt);
                      }}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full transition',
                        selected
                          ? 'text-white/90 hover:bg-white/20'
                          : 'text-red-600 hover:bg-red-50'
                      )}
                      aria-label={`Delete ${mt.name}`}
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
          {!isAdmin ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-[#EDE8FF]/25 px-4 py-2 text-[13px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50"
          >
            <IoAddCircleOutline size={18} />
            New
          </button>
          ) : null}
        </div>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
          onClick={closeModal}
        >
          <div
            className="relative linkup-card w-full max-w-md overflow-hidden rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/10 to-transparent" />
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-white/90 text-muted hover:text-primary"
              aria-label="Close"
            >
              <IoClose size={18} />
            </button>
            <div className="relative space-y-4 p-5 min-[425px]:p-6">
              <div className="pr-8">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
                  Custom type
                </p>
                <h3 className="font-display text-xl font-extrabold text-foreground">
                  {isEditMode ? 'Edit meet type' : 'New meet type'}
                </h3>
                <p className="mt-1 text-[13px] font-semibold text-muted">
                  We&apos;ll pick an icon from your title.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-[#EDE8FF]/40 px-4 py-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
                  <MeetTypeIcon icon={previewIcon} size={22} />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Preview</p>
                  <p className="text-[14px] font-extrabold text-foreground">
                    {formName.trim() || 'Your meet type'}
                  </p>
                </div>
              </div>

              <Input
                label="Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Board games night"
              />

              <div>
                <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-muted">
                  Default duration
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.m}
                      type="button"
                      onClick={() => setFormDuration(d.m)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[12px] font-extrabold',
                        formDuration === d.m
                          ? 'linkup-gradient-primary text-white'
                          : 'border border-border bg-white text-primary'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {formError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 min-[425px]:flex-row min-[425px]:justify-end">
                <button
                  type="button"
                  disabled={formBusy}
                  onClick={closeModal}
                  className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={formBusy || !formName.trim()}
                  onClick={() => void handleSave()}
                  className="min-h-[44px] rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white disabled:opacity-50"
                >
                  {formBusy ? 'Saving…' : isEditMode ? 'Save changes' : 'Create type'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MeetTypeReviewPendingModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        meetTypeName={reviewModalType?.name ?? ''}
        mode={reviewModalMode}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete meet type?"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from your list? This only works if no plans use it.`
            : ''
        }
        cancelLabel="Keep"
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <AppStatusDialog
        open={!!deleteBlockedMsg}
        variant="error"
        title="Cannot delete meet type"
        message={deleteBlockedMsg ?? ''}
        buttonLabel="Got it"
        onClose={() => setDeleteBlockedMsg(null)}
      />
    </div>
  );
}

export function isMoodMeetType(mt: DbMeetType | null | undefined): boolean {
  return mt?.slug === 'mood';
}

export function isGroupMeetType(mt: DbMeetType | null | undefined): boolean {
  return mt?.slug === 'group';
}

export function applyMeetTypeDefaults(mt: DbMeetType): {
  durationMinutes: number;
  escrowPattern: EscrowPattern;
  isGroupPlan: boolean;
  isMoodMeetType: boolean;
} {
  return {
    durationMinutes: mt.default_duration_minutes,
    escrowPattern: (mt.default_pattern as EscrowPattern) ?? 'A',
    isGroupPlan: isGroupMeetType(mt),
    isMoodMeetType: isMoodMeetType(mt),
  };
}
