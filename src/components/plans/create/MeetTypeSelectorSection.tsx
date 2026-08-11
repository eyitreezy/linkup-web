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
import { useCallback, useEffect, useRef, useState } from 'react';
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

  const POPULAR_SLUGS = ['mood', 'dinner', 'dinner-date', 'casual', 'hangout', 'gym-buddy', 'gym'];
  const SOCIAL_SLUGS = [
    'group',
    'brunch-meet',
    'street-food',
    'cook-together-experience',
    'lounge-drinks',
    'live-event',
    'game-night',
    'run-club',
    'spa-wellness',
    'sports-companion',
  ];

  const popularTypes = (meetTypes ?? []).filter((mt) => POPULAR_SLUGS.includes(mt.slug ?? ''));
  const socialTypes = (meetTypes ?? []).filter((mt) => SOCIAL_SLUGS.includes(mt.slug ?? ''));
  const extendedTypes = (meetTypes ?? []).filter(
    (mt) =>
      !POPULAR_SLUGS.includes(mt.slug ?? '') &&
      !SOCIAL_SLUGS.includes(mt.slug ?? '') &&
      !canUserManageMeetType(mt, user?.id)
  );
  const customTypes = (meetTypes ?? []).filter((mt) => canUserManageMeetType(mt, user?.id));

  function escrowPatternLabel(pattern: string | null | undefined): string {
    if (pattern === 'A') return 'Host funds';
    if (pattern === 'B') return 'Split 50/50';
    if (pattern === 'C') return 'Guest funds';
    return '';
  }

  const selectedMeetType = (meetTypes ?? []).find((mt) => mt.id === meetTypeId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-[#0F172A]">Meet type</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#0F172A]">
          Pick a meet type for your plan from the options below.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[80, 64, 48].map((w) => (
            <div
              key={w}
              className="h-10 animate-pulse rounded-2xl bg-[#EDE8FF]/60"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {popularTypes.length > 0 ? (
            <MeetTypeRow
              label="Popular"
              types={popularTypes}
              selectedId={meetTypeId}
              userId={user?.id}
              isAdmin={isAdmin}
              onSelect={handleSelect}
              onEdit={openEditModal}
              onDelete={(mt) => setDeleteTarget(mt)}
            />
          ) : null}

          {socialTypes.length > 0 ? (
            <MeetTypeRow
              label="Social & activities"
              types={socialTypes}
              selectedId={meetTypeId}
              userId={user?.id}
              isAdmin={isAdmin}
              onSelect={handleSelect}
              onEdit={openEditModal}
              onDelete={(mt) => setDeleteTarget(mt)}
            />
          ) : null}

          {extendedTypes.length > 0 ? (
            <MeetTypeRow
              label="More"
              types={extendedTypes}
              selectedId={meetTypeId}
              userId={user?.id}
              isAdmin={isAdmin}
              onSelect={handleSelect}
              onEdit={openEditModal}
              onDelete={(mt) => setDeleteTarget(mt)}
            />
          ) : null}

          {customTypes.length > 0 ? (
            <MeetTypeRow
              label="Your types"
              types={customTypes}
              selectedId={meetTypeId}
              userId={user?.id}
              isAdmin={isAdmin}
              onSelect={handleSelect}
              onEdit={openEditModal}
              onDelete={(mt) => setDeleteTarget(mt)}
            />
          ) : null}

          {selectedMeetType ? (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-[#EDE8FF]/30 px-4 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <MeetTypeIcon icon={selectedMeetType.icon} selected={false} size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold text-foreground">{selectedMeetType.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {selectedMeetType.default_duration_minutes ? (
                    <span className="text-[12px] font-semibold text-muted">
                      {selectedMeetType.default_duration_minutes >= 60
                        ? `${selectedMeetType.default_duration_minutes / 60}h default`
                        : `${selectedMeetType.default_duration_minutes}min default`}
                    </span>
                  ) : null}
                  {escrowPatternLabel(selectedMeetType.default_pattern) ? (
                    <span className="text-[12px] font-semibold text-muted">
                      {escrowPatternLabel(selectedMeetType.default_pattern)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 rounded-full linkup-gradient-primary px-3 py-1">
                <span className="text-[11px] font-extrabold text-white">Selected</span>
              </div>
            </div>
          ) : null}

          {!isAdmin ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-[#EDE8FF]/20 py-3 text-[13px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/40"
            >
              <IoAddCircleOutline size={18} />
              Add your own meet type
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

interface MeetTypeRowProps {
  label: string;
  types: DbMeetType[];
  selectedId: string | null;
  userId: string | undefined;
  isAdmin: boolean;
  onSelect: (mt: DbMeetType) => void;
  onEdit: (mt: DbMeetType) => void;
  onDelete: (mt: DbMeetType) => void;
}

function MeetTypeRow({
  label,
  types,
  selectedId,
  userId,
  isAdmin,
  onSelect,
  onEdit,
  onDelete,
}: MeetTypeRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    hasDragged.current = true;
    const el = scrollRef.current;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    el.scrollLeft = scrollLeft.current - walk;
  }, []);

  const stopDrag = useCallback(() => {
    if (!scrollRef.current) return;
    isDragging.current = false;
    scrollRef.current.style.cursor = 'grab';
    scrollRef.current.style.userSelect = '';
  }, []);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#0F172A]/80">{label}</p>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none select-none"
        style={{ cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        {types.map((mt) => {
          const selected = selectedId === mt.id;
          const pending = isPendingMeetType(mt, userId);
          const canManage = canUserManageMeetType(mt, userId) && !isAdmin;

          const handleSelect = () => {
            if (!hasDragged.current) onSelect(mt);
          };

          return (
            <div key={mt.id} className={cn('group relative shrink-0', pending && 'opacity-60')}>
              <button
                type="button"
                onClick={handleSelect}
                disabled={pending}
                className={cn(
                  'flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold transition',
                  selected
                    ? 'linkup-gradient-primary text-white shadow-sm'
                    : 'border border-border bg-white text-foreground hover:border-primary/40 hover:bg-[#EDE8FF]/20',
                  canManage && !selected && 'border-dashed border-primary/35 bg-[#EDE8FF]/20',
                  pending && 'cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    selected ? 'bg-white/20' : 'bg-[#EDE8FF]/60'
                  )}
                >
                  <MeetTypeIcon icon={mt.icon} selected={selected} size={14} />
                </span>
                {mt.name}
                {pending ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                    Pending
                  </span>
                ) : null}
              </button>
              {canManage ? (
                <div className="absolute -right-1 -top-1 hidden items-center gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(mt);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white shadow-sm text-primary hover:bg-[#EDE8FF]/40"
                    aria-label={`Edit ${mt.name}`}
                  >
                    <IoPencil size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(mt);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white shadow-sm text-red-500 hover:bg-red-50"
                    aria-label={`Delete ${mt.name}`}
                  >
                    <IoTrashOutline size={11} />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
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
