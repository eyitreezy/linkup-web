'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { Input } from '@/components/ui/Input';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import {
  cancelInvitation,
  fetchPlanInvitations,
  searchUsersForInvitation,
  sendInvitationByEmail,
  sendInvitationToUser,
  type InvitationSearchResult,
  type PlanInvitationRow,
  type PlanInviteDetails,
} from '@/lib/plans/planInvitations';
import {
  inviteErrorDialogContent,
  inviteSuccessDialogContent,
  mapInviteClientError,
} from '@/lib/plans/inviteErrorMessages';
import { invitationSearchAlreadyMemberLabel } from '@/lib/plans/invitationSearchMemberLabel';
import { planExpiredDialogContent } from '@/lib/plans/planExpiredDialog';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useState } from 'react';
import { IoCheckmarkCircle, IoPeopleOutline } from 'react-icons/io5';

const STATUS_BADGES: Record<
  PlanInvitationRow['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-amber-500/12 text-amber-800' },
  accepted: { label: 'Accepted', className: 'bg-emerald-500/12 text-emerald-700' },
  declined: { label: 'Declined', className: 'bg-red-500/12 text-red-700' },
  expired: { label: 'Expired', className: 'bg-muted/15 text-muted' },
  cancelled: { label: 'Cancelled', className: 'bg-muted/15 text-muted' },
};

function UserSearchRow({
  user,
  onInvite,
  disabled,
  inviting,
}: {
  user: InvitationSearchResult;
  onInvite: () => void;
  disabled: boolean;
  inviting: boolean;
}) {
  const name = user.display_name?.trim() || 'LinkUp member';

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ProfileAvatar
          profile={{ avatar_url: user.avatar_url, primary_photo_url: null, photo_urls: null }}
          displayName={name}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold text-foreground">{name}</p>
          {!user.already_member && user.username ? (
            <p className="truncate text-[12px] font-semibold text-muted">@{user.username}</p>
          ) : !user.already_member && user.is_kyc_verified ? (
            <p className="flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
              <IoCheckmarkCircle size={14} />
              Verified
            </p>
          ) : !user.already_member ? (
            <p className="text-[12px] font-semibold text-muted">Not verified yet</p>
          ) : null}
        </div>
      </div>
      {user.already_member ? (
        <span className="max-w-[8rem] shrink-0 text-right text-[11px] font-extrabold leading-snug text-amber-800">
          {invitationSearchAlreadyMemberLabel(user.gender)}
        </span>
      ) : user.already_invited ? (
        <span className="shrink-0 text-[12px] font-semibold text-muted">Invited</span>
      ) : (
        <button
          type="button"
          onClick={onInvite}
          disabled={disabled || inviting || user.already_member}
          className="shrink-0 rounded-full linkup-gradient-primary px-3 py-1.5 text-[12px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-40"
        >
          {inviting ? 'Sending…' : 'Invite'}
        </button>
      )}
    </div>
  );
}

function SentInvitationRow({
  invitation,
  onCancel,
}: {
  invitation: PlanInvitationRow;
  onCancel: () => void;
}) {
  const badge = STATUS_BADGES[invitation.status] ?? STATUS_BADGES.pending;
  const label =
    invitation.invitee?.display_name?.trim() ||
    invitation.invitee_email ||
    'Invited user';

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <ProfileAvatar profile={invitation.invitee} displayName={label} size={28} />
        <p className="truncate text-[13px] font-semibold text-foreground">{label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold', badge.className)}>
          {badge.label}
        </span>
        {invitation.status === 'pending' ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] font-semibold text-primary hover:text-red-600"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  planId: string;
  planDetails: PlanInviteDetails;
  availableSlots: number;
  planListingExpired?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSlotsChanged?: () => void;
  onPlanExpired?: () => void;
};

export function InviteGuestsModal({
  planId,
  planDetails,
  availableSlots,
  planListingExpired = false,
  open,
  onOpenChange,
  onSlotsChanged,
  onPlanExpired,
}: Props) {
  const [activeTab, setActiveTab] = useState<'search' | 'email'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InvitationSearchResult[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sentInvitations, setSentInvitations] = useState<PlanInvitationRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ title: string; message: string } | null>(null);

  const refreshInvitations = useCallback(async () => {
    const updated = await fetchPlanInvitations(planId);
    setSentInvitations(updated);
    onSlotsChanged?.();
  }, [planId, onSlotsChanged]);

  function showInviteError(err: unknown) {
    const raw = err instanceof Error ? err.message : '';
    const code = mapInviteClientError(raw);
    setStatusDialog(inviteErrorDialogContent(code));
  }

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersForInvitation(searchQuery.trim(), planId);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, planId]);

  useEffect(() => {
    if (!open) return;
    void refreshInvitations();
  }, [open, refreshInvitations]);

  function guardExpiredInvite(): boolean {
    if (!planListingExpired) return false;
    const dialog = planExpiredDialogContent('invite');
    setStatusDialog(dialog);
    onPlanExpired?.();
    return true;
  }

  async function handleSendToUser(userId: string) {
    if (guardExpiredInvite()) return;
    if (availableSlots <= 0) return;
    const target = searchResults.find((r) => r.user_id === userId);
    if (target?.already_member) return;
    setIsSending(true);
    setInvitingUserId(userId);
    try {
      await sendInvitationToUser(planId, userId, planDetails);
      await refreshInvitations();
      setSearchResults((prev) =>
        prev.map((r) => (r.user_id === userId ? { ...r, already_invited: true } : r))
      );
      setStatusDialog(inviteSuccessDialogContent());
    } catch (err: unknown) {
      showInviteError(err);
    } finally {
      setIsSending(false);
      setInvitingUserId(null);
    }
  }

  async function handleSendByEmail() {
    if (guardExpiredInvite()) return;
    const email = emailInput.trim();
    if (!email || availableSlots <= 0) return;
    setIsSending(true);
    try {
      const result = await sendInvitationByEmail(planId, email, planDetails);
      setEmailInput('');
      await refreshInvitations();
      setStatusDialog(
        result.delivery === 'in_app'
          ? inviteSuccessDialogContent()
          : inviteSuccessDialogContent(email)
      );
    } catch (err: unknown) {
      showInviteError(err);
    } finally {
      setIsSending(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-guests-title"
      >
        <div className="linkup-card flex max-h-[min(88vh,720px)] w-full min-w-0 max-w-md flex-col rounded-2xl p-4 shadow-xl min-[425px]:p-6">
          <h2 id="invite-guests-title" className="font-display text-lg font-extrabold text-foreground">
            Invite guests
          </h2>

          {planListingExpired ? (
            <p className="mt-2 rounded-xl bg-slate-500/10 px-3 py-2 text-[13px] font-semibold text-slate-700">
              This plan has ended and is no longer accepting invitations.
            </p>
          ) : null}

          <div
            className={cn(
              'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold',
              availableSlots > 0
                ? 'bg-emerald-500/10 text-emerald-800'
                : 'bg-amber-500/10 text-amber-800'
            )}
          >
            <IoPeopleOutline className="mt-0.5 shrink-0" size={16} />
            <p>
              {availableSlots > 0
                ? `${availableSlots} slot${availableSlots === 1 ? '' : 's'} available`
                : 'No slots available. Slots free up when invitations expire or are declined.'}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            {(['search', 'email'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  'flex-1 inline-flex min-h-[44px] items-center justify-center rounded-full px-3 py-2 text-[13px] font-extrabold transition',
                  activeTab === tab
                    ? 'bg-primary/12 text-primary'
                    : 'bg-[#F8F9FC] text-muted hover:bg-[#EDE8FF]/50'
                )}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'search' ? 'Find on LinkUp' : 'Invite by email'}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'search' ? (
              <div className="space-y-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, username or phone"
                  autoComplete="off"
                  disabled={planListingExpired}
                />
                {isSearching ? (
                  <p className="py-3 text-center text-[13px] font-semibold text-muted">Searching…</p>
                ) : null}
                <div className="max-h-52 overflow-y-auto">
                  {searchResults.map((user) => (
                    <UserSearchRow
                      key={user.user_id}
                      user={user}
                      onInvite={() => void handleSendToUser(user.user_id)}
                      disabled={
                        planListingExpired ||
                        user.already_invited ||
                        user.already_member ||
                        availableSlots <= 0
                      }
                      inviting={isSending && invitingUserId === user.user_id}
                    />
                  ))}
                  {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 ? (
                    <p className="py-3 text-center text-[13px] font-semibold text-muted">
                      No users found matching that search.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter email address"
                autoComplete="email"
                disabled={planListingExpired}
              />
            )}

            {sentInvitations.length > 0 ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Sent invitations
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {sentInvitations.map((inv) => (
                    <SentInvitationRow
                      key={inv.id}
                      invitation={inv}
                      onCancel={() => {
                        void (async () => {
                          try {
                            await cancelInvitation(inv.id);
                            await refreshInvitations();
                          } catch {
                            setStatusDialog({
                              title: 'Could not cancel',
                              message: 'Please try again.',
                            });
                          }
                        })();
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {activeTab === 'email' ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSendByEmail()}
                disabled={planListingExpired || !emailInput.trim() || availableSlots <= 0 || isSending}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-40"
              >
                {isSending ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <AppStatusDialog
        open={statusDialog !== null}
        variant="info"
        title={statusDialog?.title ?? ''}
        message={statusDialog?.message ?? ''}
        onClose={() => setStatusDialog(null)}
      />
    </>
  );
}
