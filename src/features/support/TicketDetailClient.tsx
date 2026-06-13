'use client';

import { ReplyBubble } from '@/components/admin/ReplyBubble';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbSupportTicket, DbTicketReply, TicketStatus } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function statusLabel(s: TicketStatus): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return s;
  }
}

function statusClass(s: TicketStatus): string {
  if (s === 'resolved' || s === 'closed') return 'bg-emerald-500/15 text-emerald-800';
  if (s === 'in_progress') return 'bg-amber-500/15 text-amber-800';
  return 'bg-primary/10 text-primary';
}

type Props = {
  ticket: DbSupportTicket;
  initialReplies: DbTicketReply[];
};

export function TicketDetailClient({ ticket, initialReplies }: Props) {
  const user = useAuthStore((s) => s.user);
  const [replies, setReplies] = useState(initialReplies);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const canReply = useMemo(
    () => ticket.status === 'open' || ticket.status === 'in_progress',
    [ticket.status]
  );

  const loadReplies = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });
    setReplies((data as DbTicketReply[]) ?? []);
  }, [ticket.id]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`ticket-replies-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_replies',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const row = payload.new as DbTicketReply;
          if (row.is_internal) return;
          setReplies((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [ticket.id]);

  async function sendReply() {
    if (!user?.id || !replyText.trim() || !canReply) return;
    setSending(true);
    const client = createClient();
    const { error } = await client.from('ticket_replies').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: 'member',
      body: replyText.trim(),
      is_internal: false,
    });
    setSending(false);
    if (!error) {
      setReplyText('');
      void loadReplies();
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <SettingsPageHeader
        kicker="Help"
        title={ticket.subject}
        subtitle={`Opened ${new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        backHref="/support"
        backLabel="Back to support"
        actions={
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusClass(ticket.status)}`}
          >
            {statusLabel(ticket.status)}
          </span>
        }
      />

      <div className="linkup-card p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Your message</p>
        <p className="mt-2 whitespace-pre-wrap text-[14px] font-semibold leading-relaxed text-foreground">
          {ticket.body}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Conversation</p>
        {replies.length === 0 ? (
          <p className="text-[13px] font-semibold text-muted">No replies yet — our team will respond soon.</p>
        ) : (
          <div className="space-y-2">
            {replies.map((r) => (
              <ReplyBubble key={r.id} reply={r} />
            ))}
          </div>
        )}
      </div>

      {canReply ? (
        <div className="linkup-card space-y-3 p-4">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Add a reply…"
            rows={3}
            className="w-full resize-none rounded-xl border border-border px-3 py-2 text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <button
            type="button"
            disabled={!replyText.trim() || sending}
            onClick={() => void sendReply()}
            className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      ) : (
        <p className="text-center text-[13px] font-semibold text-muted">
          This ticket is closed.{' '}
          <Link href="/support" className="font-extrabold text-primary underline">
            Open a new ticket
          </Link>
        </p>
      )}
    </div>
  );
}
