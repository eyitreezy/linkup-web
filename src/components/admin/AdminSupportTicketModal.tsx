'use client';

import { ReplyBubble } from '@/components/admin/ReplyBubble';
import { SlaDeadlineBadge } from '@/components/admin/SlaDeadlineBadge';
import { TierBadge } from '@/components/subscription/TierBadge';
import {
  AdminMetaRow,
  AdminModal,
  AdminMonoBlock,
  AdminPrimaryButton,
  CopyIdsButton,
  StatusPill,
} from '@/features/admin/adminUi';
import { ticketPriorityTone, ticketStatusTone } from '@/lib/admin/adminLabels';
import {
  loadTicketReplies,
  sendTicketReply,
  updateSupportTicket,
} from '@/services/admin.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbSupportTicket, DbTicketReply, TicketStatus } from '@/types/database';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useState } from 'react';
import { IoLockClosed, IoMailOutline, IoTimeOutline } from 'react-icons/io5';

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

type Props = {
  ticket: DbSupportTicket | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function AdminSupportTicketModal({ ticket, onClose, onUpdated }: Props) {
  const user = useAuthStore((s) => s.user);
  const [replies, setReplies] = useState<DbTicketReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const loadReplies = useCallback(async () => {
    if (!ticket?.id) {
      setReplies([]);
      return;
    }
    setLoadingReplies(true);
    const rows = await loadTicketReplies(ticket.id);
    setReplies(rows);
    setLoadingReplies(false);
  }, [ticket?.id]);

  useEffect(() => {
    void loadReplies();
  }, [loadReplies]);

  async function handleStatusChange(next: TicketStatus) {
    if (!ticket) return;
    setStatusBusy(true);
    await updateSupportTicket(ticket.id, { status: next });
    setStatusBusy(false);
    onUpdated();
  }

  async function handleSendReply() {
    if (!ticket || !user?.id || !replyText.trim()) return;
    setSending(true);
    const { error } = await sendTicketReply({
      ticketId: ticket.id,
      senderId: user.id,
      body: replyText,
      isInternal,
    });
    setSending(false);
    if (error) return;
    setReplyText('');
    void loadReplies();
    onUpdated();
  }

  return (
    <AdminModal
      open={!!ticket}
      onClose={onClose}
      title={ticket?.subject?.trim() || 'Support ticket'}
      kicker="Support"
      footer={
        ticket ? (
          <AdminPrimaryButton variant="ghost" onClick={onClose}>
            Close
          </AdminPrimaryButton>
        ) : null
      }
    >
      {ticket ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={ticket.status} tone={ticketStatusTone(ticket.status)} />
            <StatusPill label={ticket.priority} tone={ticketPriorityTone(ticket.priority)} />
            {ticket.is_concierge ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[11px] font-extrabold text-violet-700">
                <TierBadge tier="PLATINUM" size="sm" />
                Concierge
              </span>
            ) : null}
            {ticket.sla_deadline ? <SlaDeadlineBadge deadline={ticket.sla_deadline} /> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={statusBusy}
                onClick={() => void handleStatusChange(s)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition',
                  ticket.status === s
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-white text-muted hover:bg-[#F5F6FA]'
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <p className="whitespace-pre-wrap rounded-xl bg-[#F5F6FA] p-4 text-[14px] font-semibold leading-relaxed">
            {ticket.body?.trim() || '(Empty message)'}
          </p>

          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Thread</p>
            {loadingReplies ? (
              <p className="text-[13px] font-semibold text-muted">Loading replies…</p>
            ) : replies.length === 0 ? (
              <p className="text-[13px] font-semibold italic text-muted">No replies yet</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {replies.map((r) => (
                  <ReplyBubble key={r.id} reply={r} isAdminViewing />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 pt-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={isInternal ? 'Internal note…' : 'Reply to member…'}
              rows={3}
              className="w-full resize-none rounded-xl border border-border px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsInternal((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition',
                  isInternal
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-border text-muted hover:bg-[#F5F6FA]'
                )}
              >
                {isInternal ? (
                  <IoLockClosed size={12} aria-hidden />
                ) : (
                  <IoMailOutline size={12} aria-hidden />
                )}
                {isInternal ? 'Internal note' : 'Reply to member'}
              </button>
              <AdminPrimaryButton
                disabled={!replyText.trim() || sending}
                onClick={() => void handleSendReply()}
              >
                {sending ? 'Sending…' : 'Send'}
              </AdminPrimaryButton>
            </div>
          </div>

          {ticket.user_id ? (
            <div className="flex items-center justify-between gap-2">
              <AdminMonoBlock label="Member id" value={ticket.user_id} />
              <CopyIdsButton text={ticket.user_id} label="Copy member id" />
            </div>
          ) : null}

          <AdminMetaRow icon={<IoTimeOutline size={14} />}>
            {new Date(ticket.created_at).toLocaleString()}
          </AdminMetaRow>
        </div>
      ) : null}
    </AdminModal>
  );
}
