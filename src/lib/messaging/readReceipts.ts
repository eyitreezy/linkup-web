import type { ChatMessageRow } from '@/services/messages.service';

/** Approximate “read” when the peer has any later message (1:1 heuristic; no server read cursor). */
export function approxReadByMessageId(
  messages: ChatMessageRow[],
  myUserId: string | undefined
): Map<string, boolean> {
  if (!myUserId) return new Map();
  let latestPeerMs = 0;
  for (const m of messages) {
    if (!m.sender_id || m.sender_id === myUserId) continue;
    latestPeerMs = Math.max(latestPeerMs, new Date(m.created_at).getTime());
  }
  const map = new Map<string, boolean>();
  for (const m of messages) {
    if (!m.sender_id || m.sender_id !== myUserId) continue;
    const t = new Date(m.created_at).getTime();
    map.set(m.id, latestPeerMs > t);
  }
  return map;
}
