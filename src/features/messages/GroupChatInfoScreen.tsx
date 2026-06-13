'use client';

import { FormCard } from '@/components/settings/FormCard';
import { TierBadge } from '@/components/subscription/TierBadge';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { GroupAvatarCell } from '@/features/messages/GroupAvatarCell';
import {
  addGroupChatMember,
  fetchActiveGroupMembers,
  leaveGroupChat,
  removeGroupChatMember,
  type GroupChatMemberRow,
} from '@/lib/messaging/groupChatMembers';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatReportDialog } from '@/features/messages/ChatReportDialog';
import { IoAdd, IoChevronBack, IoClose, IoFlagOutline } from 'react-icons/io5';

type Props = {
  conversationId: string;
};

type EligibleGuest = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
};

export function GroupChatInfoScreen({ conversationId }: Props) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupChatMemberRow[]>([]);
  const [maxCap, setMaxCap] = useState(8);
  const [addOpen, setAddOpen] = useState(false);
  const [eligibleGuests, setEligibleGuests] = useState<EligibleGuest[]>([]);
  const [removeTarget, setRemoveTarget] = useState<GroupChatMemberRow | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMemberId, setReportMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const client = createClient();
    const { data: conv } = await client
      .from('conversations')
      .select('group_name, plan_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (conv) {
      setGroupName((conv.group_name as string) ?? 'Group chat');
      setPlanId((conv.plan_id as string | null) ?? null);
      if (conv.plan_id) {
        const { data: plan } = await client
          .from('plans')
          .select('title, max_guests')
          .eq('id', conv.plan_id)
          .maybeSingle();
        setPlanTitle((plan?.title as string) ?? null);
        if (plan?.max_guests) setMaxCap(plan.max_guests as number);
      }
    }
    const rows = await fetchActiveGroupMembers(client, conversationId);
    setMembers(rows);
  }, [conversationId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const myMember = useMemo(
    () => members.find((m) => m.user_id === user?.id),
    [members, user?.id]
  );
  const isAdmin = !!myMember?.is_admin;

  async function saveGroupName(next: string) {
    if (!isAdmin || !next.trim()) return;
    const client = createClient();
    const { error: err } = await client
      .from('conversations')
      .update({ group_name: next.trim() })
      .eq('id', conversationId);
    if (err) setError(err.message);
    else setGroupName(next.trim());
    setEditingName(false);
  }

  async function openAddMembers() {
    if (!planId || !user?.id) return;
    const client = createClient();
    const memberIds = new Set(members.map((m) => m.user_id));
    const { data: offers } = await client
      .from('plan_offers')
      .select('bidder_id')
      .eq('plan_id', planId)
      .eq('status', 'accepted');
    const guestIds = (offers ?? []).map((o) => o.bidder_id as string).filter((id) => !memberIds.has(id));
    if (!guestIds.length) {
      setEligibleGuests([]);
      setAddOpen(true);
      return;
    }
    const [{ data: profiles }, { data: users }] = await Promise.all([
      client.from('profiles').select('user_id, display_name, avatar_url').in('user_id', guestIds),
      client.from('users').select('id, subscription_tier').in('id', guestIds),
    ]);
    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const tierMap = new Map((users ?? []).map((u) => [u.id as string, u]));
    setEligibleGuests(
      guestIds.map((id) => {
        const p = profMap.get(id);
        const t = tierMap.get(id);
        return {
          id,
          display_name: (p?.display_name as string | null) ?? null,
          avatar_url: (p?.avatar_url as string | null) ?? null,
          subscription_tier: (t?.subscription_tier as SubscriptionTier) ?? 'FREE',
        };
      })
    );
    setAddOpen(true);
  }

  async function handleAdd(guestId: string) {
    if (!user?.id || !planId) return;
    setBusy(true);
    setError(null);
    try {
      const client = createClient();
      await addGroupChatMember(client, conversationId, guestId, user.id, planId);
      await load();
      setAddOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!user?.id || !removeTarget) return;
    setBusy(true);
    try {
      const client = createClient();
      await removeGroupChatMember(client, conversationId, removeTarget.user_id, user.id);
      setRemoveTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove member');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!user?.id) return;
    setBusy(true);
    try {
      const client = createClient();
      await leaveGroupChat(client, conversationId, user.id);
      router.push('/messages');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave group');
      setBusy(false);
      setLeaveOpen(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-16 pt-2">
      <div className="flex items-center gap-2">
        <Link
          href={`/chat/group/${conversationId}`}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-[#F5F6FA]"
          aria-label="Back to group chat"
        >
          <IoChevronBack size={24} />
        </Link>
        <h1 className="font-display text-xl font-extrabold text-foreground">Group info</h1>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <FormCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <GroupAvatarCell groupName={groupName} memberPreviews={members.map((m) => ({
            avatarUrl: m.user?.avatar_url ?? null,
            name: m.user?.display_name ?? 'Member',
          }))} size={80} />
          {isAdmin && editingName ? (
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onBlur={() => void saveGroupName(groupName)}
              autoFocus
              className="w-full rounded-xl border border-border px-3 py-2 text-center text-[16px] font-extrabold"
            />
          ) : (
            <button
              type="button"
              onClick={() => isAdmin && setEditingName(true)}
              className="font-display text-lg font-extrabold text-foreground"
            >
              {groupName}
            </button>
          )}
          {planId ? (
            <Link href={`/plan/${planId}`} className="text-[13px] font-extrabold text-primary underline">
              {planTitle ?? 'View plan'}
            </Link>
          ) : null}
        </div>
      </FormCard>

      <FormCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold text-foreground">
            Members ({members.length}{maxCap ? ` of ${maxCap}` : ''})
          </h2>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void openAddMembers()}
              className="inline-flex items-center gap-1 text-[13px] font-extrabold text-primary"
            >
              <IoAdd size={16} />
              Add members
            </button>
          ) : null}
        </div>
        <ul className="divide-y divide-border/60">
          {members.map((m) => (
            <li key={m.id} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              {m.user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary">
                  {(m.user?.display_name ?? 'M').charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold text-foreground">{m.user?.display_name ?? 'Member'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {m.is_admin ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      Admin
                    </span>
                  ) : null}
                  <TierBadge tier={(m.user?.subscription_tier as SubscriptionTier) ?? 'FREE'} size="sm" />
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                {m.user_id !== user?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReportMemberId(m.user_id);
                      setReportOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold text-red-600 hover:bg-red-50"
                  >
                    <IoFlagOutline size={14} aria-hidden />
                    Report
                  </button>
                ) : null}
                {isAdmin && !m.is_admin && m.user_id !== user?.id ? (
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(m)}
                    className="rounded-full p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove member"
                  >
                    <IoClose size={18} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </FormCard>

      {!isAdmin ? (
        <FormCard>
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="w-full py-1 text-left text-[14px] font-extrabold text-red-600 transition hover:text-red-700"
          >
            Leave group
          </button>
        </FormCard>
      ) : null}

      {addOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="linkup-card max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-foreground">Add members</h3>
            <p className="mt-1 text-[13px] font-semibold text-muted">Add accepted guests from this plan</p>
            <div className="mt-4 space-y-2">
              {eligibleGuests.length === 0 ? (
                <p className="py-8 text-center text-[13px] font-semibold text-muted">
                  All accepted guests are already in the group.
                </p>
              ) : (
                eligibleGuests.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    disabled={busy || members.length >= maxCap}
                    onClick={() => void handleAdd(guest.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F8F7FF] disabled:opacity-50"
                  >
                    {guest.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={guest.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary">
                        {(guest.display_name ?? 'G').charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-foreground">{guest.display_name ?? 'Guest'}</p>
                      <TierBadge tier={guest.subscription_tier} size="sm" />
                    </div>
                    <IoAdd className="text-muted" size={18} />
                  </button>
                ))
              )}
            </div>
            {members.length >= maxCap ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[13px] font-semibold text-amber-800">
                  Group is full ({members.length}/{maxCap} members)
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member?"
        message={`Remove ${removeTarget?.user?.display_name ?? 'this member'} from the group?`}
        cancelLabel="Cancel"
        confirmLabel="Remove"
        confirmVariant="danger"
        busy={busy}
        onClose={() => {
          if (!busy) setRemoveTarget(null);
        }}
        onConfirm={() => void handleRemove()}
      />

      {user?.id && reportMemberId ? (
        <ChatReportDialog
          open={reportOpen}
          onClose={() => {
            setReportOpen(false);
            setReportMemberId(null);
          }}
          reporterId={user.id}
          reportedUserId={reportMemberId}
        />
      ) : null}

      <ConfirmDialog
        open={leaveOpen}
        title={`Leave ${groupName}?`}
        message="You won't receive new messages from this group. Your past messages stay visible to other members."
        cancelLabel="Cancel"
        confirmLabel="Leave group"
        confirmVariant="danger"
        busy={busy}
        onClose={() => {
          if (!busy) setLeaveOpen(false);
        }}
        onConfirm={() => void handleLeave()}
      />
    </div>
  );
}
