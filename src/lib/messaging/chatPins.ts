const STORAGE_KEY = 'linkup/chat_pins_v1';

type PinMap = Record<string, string>;

function pinKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

function readMap(): PinMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PinMap;
  } catch {
    return {};
  }
}

function writeMap(map: PinMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getPinnedMessageId(userId: string, conversationId: string): string | null {
  const map = readMap();
  return map[pinKey(userId, conversationId)] ?? null;
}

export function setPinnedMessageId(
  userId: string,
  conversationId: string,
  messageId: string | null
): void {
  const map = readMap();
  const key = pinKey(userId, conversationId);
  if (messageId) map[key] = messageId;
  else delete map[key];
  writeMap(map);
}
