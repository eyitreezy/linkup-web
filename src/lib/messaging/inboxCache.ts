import { markConversationReadDefault } from '@/lib/messaging/conversationReads';

const KEY = 'linkup/inbox_last_read_v1';

export function getLastReadMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setConversationLastRead(
  conversationId: string,
  iso: string,
  messageId?: string | null
): void {
  if (typeof window === 'undefined') return;
  const map = getLastReadMap();
  const prev = map[conversationId];
  if (!prev || new Date(iso) > new Date(prev)) {
    map[conversationId] = iso;
    localStorage.setItem(KEY, JSON.stringify(map));
  }
  markConversationReadDefault(conversationId, messageId ?? null);
}
