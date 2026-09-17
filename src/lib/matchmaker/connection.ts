export type MatchMakerConnectionRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: 'active' | 'ended' | 'paused';
  connected_at: string;
  first_message_at: string | null;
  plan_unlock_at: string | null;
  ended_at: string | null;
  first_plan_created_at: string | null;
  paused_at?: string | null;
};

export function partnerUserId(connection: MatchMakerConnectionRow, viewerId: string): string | null {
  if (connection.user_a_id === viewerId) return connection.user_b_id;
  if (connection.user_b_id === viewerId) return connection.user_a_id;
  return null;
}

export function connectionDayNumber(connectedAt: string, now = Date.now()): number {
  const start = new Date(connectedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(1, Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1);
}

export function planWindowDaysRemaining(planUnlockAt: string | null, now = Date.now()): number | null {
  if (!planUnlockAt) return null;
  const unlock = new Date(planUnlockAt).getTime();
  if (Number.isNaN(unlock)) return null;
  const diff = unlock - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function isPlanWindowOpen(connection: MatchMakerConnectionRow, now = Date.now()): boolean {
  if (connection.first_plan_created_at) return true;
  if (!connection.plan_unlock_at) return false;
  return new Date(connection.plan_unlock_at).getTime() <= now;
}

export function isReadyToMeetAvailable(connectedAt: string, now = Date.now()): boolean {
  const day = connectionDayNumber(connectedAt, now);
  return day >= 10;
}

export function isSharedActivityAvailable(connectedAt: string, now = Date.now()): boolean {
  const day = connectionDayNumber(connectedAt, now);
  return day >= 7;
}
