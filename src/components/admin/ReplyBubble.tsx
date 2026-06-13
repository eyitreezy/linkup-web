'use client';

import type { DbTicketReply } from '@/types/database';
import { cn } from '@/utils/cn';
import { IoLockClosed } from 'react-icons/io5';

type Props = {
  reply: DbTicketReply;
  isAdminViewing?: boolean;
};

function formatRelativeTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Lightweight ticket thread bubble — simpler than ChatMessageBubble. */
export function ReplyBubble({ reply, isAdminViewing = false }: Props) {
  if (reply.is_internal && !isAdminViewing) return null;

  const isAdmin = reply.sender_role === 'admin' || reply.sender_role === 'system';
  const isInternal = reply.is_internal;

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 text-[14px]',
        isInternal
          ? 'border-amber-200/80 bg-amber-50'
          : isAdmin
            ? 'border-primary/15 bg-[#EDE8FF]/50'
            : 'border-border bg-[#F5F6FA]'
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold text-muted">
          {isAdmin ? 'Support agent' : 'You'}
        </span>
        {isInternal ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
            <IoLockClosed size={10} aria-hidden />
            Internal
          </span>
        ) : null}
        <span className="ml-auto text-[10px] font-semibold text-muted">
          {formatRelativeTime(reply.created_at)}
        </span>
      </div>
      <p className="whitespace-pre-wrap font-semibold leading-relaxed text-foreground">{reply.body}</p>
    </div>
  );
}
