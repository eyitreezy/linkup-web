import { messageDisplayText } from '@/lib/messaging/messagePreview';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { ChatMessageRow } from '@/services/messages.service';

/** WhatsApp-style window for editing sent text messages. */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Default recall window for delete-for-everyone (non-Platinum). */
export const MESSAGE_DELETE_FOR_EVERYONE_MS = 15 * 60 * 1000;

/** Platinum delete-for-everyone window. */
export const PLATINUM_DELETE_FOR_EVERYONE_MS = 60 * 60 * 1000;

export function getDeleteForEveryoneWindowMs(tier: SubscriptionTier): number {
  if (tier === 'PLATINUM') return PLATINUM_DELETE_FOR_EVERYONE_MS;
  return MESSAGE_DELETE_FOR_EVERYONE_MS;
}

export function withinMsSince(iso: string, ms: number, now = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= ms;
}

export function messageHasEditableText(
  m: Pick<ChatMessageRow, 'text' | 'body' | 'deleted_at'>
): boolean {
  if (m.deleted_at) return false;
  return (messageDisplayText(m)?.trim().length ?? 0) > 0;
}

/** Own text messages within the edit window (not media-only). */
export function canEditMessage(
  m: Pick<ChatMessageRow, 'sender_id' | 'created_at' | 'text' | 'body' | 'deleted_at'>,
  viewerId: string,
  now = Date.now()
): boolean {
  if (m.sender_id !== viewerId) return false;
  if (!messageHasEditableText(m)) return false;
  return withinMsSince(m.created_at, MESSAGE_EDIT_WINDOW_MS, now);
}

/** Reply is only available on messages received from the peer. */
export function canReplyToMessage(
  m: Pick<ChatMessageRow, 'sender_id' | 'deleted_at'>,
  viewerId: string
): boolean {
  if (m.deleted_at) return false;
  return m.sender_id !== viewerId;
}

export function findLastOwnSentMessageId(
  messages: Pick<ChatMessageRow, 'id' | 'sender_id' | 'deleted_at'>[],
  viewerId: string
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.sender_id || m.sender_id !== viewerId || m.deleted_at) continue;
    return m.id;
  }
  return null;
}

export function canDeleteMessageForEveryone(
  m: Pick<ChatMessageRow, 'id' | 'sender_id' | 'created_at' | 'deleted_at'>,
  viewerId: string,
  senderTier: SubscriptionTier,
  opts?: { lastOwnSentMessageId?: string | null; now?: number }
): boolean {
  if (!m.sender_id || m.sender_id !== viewerId) return false;
  if (m.deleted_at) return false;
  if (!withinMsSince(m.created_at, getDeleteForEveryoneWindowMs(senderTier), opts?.now)) return false;
  if (opts?.lastOwnSentMessageId != null && m.id !== opts.lastOwnSentMessageId) return false;
  return true;
}

/** Hide from this user's thread only — available on any non–deleted-for-everyone message. */
export function canDeleteMessageForMe(
  m: Pick<ChatMessageRow, 'deleted_at'>,
  hiddenForViewer: boolean
): boolean {
  if (m.deleted_at) return false;
  if (hiddenForViewer) return false;
  return true;
}
