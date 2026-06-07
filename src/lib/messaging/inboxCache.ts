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

export function setConversationLastRead(conversationId: string, iso: string): void {
  if (typeof window === 'undefined') return;
  const map = getLastReadMap();
  map[conversationId] = iso;
  localStorage.setItem(KEY, JSON.stringify(map));
}
