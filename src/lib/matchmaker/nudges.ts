import { connectionDayNumber, planWindowDaysRemaining } from '@/lib/matchmaker/connection';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';

export function shouldShowDay10Checkin(connection: MatchMakerConnectionRow, now = Date.now()): boolean {
  return connectionDayNumber(connection.connected_at, now) >= 10;
}

export function shouldShowPlanUnlock(connection: MatchMakerConnectionRow, now = Date.now()): boolean {
  const daysLeft = planWindowDaysRemaining(connection.plan_unlock_at, now);
  return daysLeft === 0 && !!connection.first_message_at;
}
