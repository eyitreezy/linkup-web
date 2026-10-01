import { planWindowDaysRemaining } from '@/lib/matchmaker/connection';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import { shouldShowDay10Checkin } from '@/lib/matchmaker/nudges';

const CONVERSATION_STARTERS = [
  'What is something you have always wanted to try but never had the chance to?',
  'What does a perfect low-key weekend look like for you?',
  'What is a small tradition you would love to share with someone?',
  'What place in your city do you wish more people knew about?',
] as const;

export function day10CheckinStorageKey(connectionId: string): string {
  return `linkup_mm_day10_dismissed_${connectionId}`;
}

export function isDay10CheckinDismissed(connectionId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(day10CheckinStorageKey(connectionId)) === '1';
  } catch {
    return false;
  }
}

export function dismissDay10Checkin(connectionId: string): void {
  try {
    localStorage.setItem(day10CheckinStorageKey(connectionId), '1');
  } catch {
    /* ignore */
  }
}

export function pickConversationStarter(connectionId: string, partnerName: string): string {
  let hash = 0;
  for (let i = 0; i < connectionId.length; i++) hash = (hash + connectionId.charCodeAt(i)) % 997;
  const prompt = CONVERSATION_STARTERS[hash % CONVERSATION_STARTERS.length];
  return `Ask ${partnerName}: ${prompt}`;
}

export function shouldRenderDay10CheckinCard(
  connection: MatchMakerConnectionRow,
  options: { partnerLastMessageAt: string | null; viewerLastMessageAt: string | null; now?: number }
): boolean {
  if (connection.status !== 'active') return false;
  if (!shouldShowDay10Checkin(connection, options.now)) return false;
  if (isDay10CheckinDismissed(connection.id)) return false;
  const day = connection.connected_at;
  const connectedMs = new Date(day).getTime();
  const now = options.now ?? Date.now();
  if (now - connectedMs > 14 * 24 * 60 * 60 * 1000) return false;
  return true;
}

export function isConversationStale(
  partnerLastMessageAt: string | null,
  viewerLastMessageAt: string | null,
  now = Date.now()
): boolean {
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  const partnerMs = partnerLastMessageAt ? new Date(partnerLastMessageAt).getTime() : 0;
  const viewerMs = viewerLastMessageAt ? new Date(viewerLastMessageAt).getTime() : 0;
  const lastAny = Math.max(partnerMs, viewerMs);
  if (!lastAny) return true;
  return now - lastAny >= fiveDays;
}

export function day10CheckinPlanDaysCopy(connection: MatchMakerConnectionRow, now = Date.now()): string {
  const left = planWindowDaysRemaining(connection.plan_unlock_at, now);
  if (!connection.first_message_at) return 'Send a first message to start your plan window.';
  if (left == null) return 'Your plan window timing is still loading.';
  if (left === 0) return 'Your plan window is open.';
  return `Your plan window opens in ${left} days. Take your time. There is no rush.`;
}
