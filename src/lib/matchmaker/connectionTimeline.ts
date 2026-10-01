import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import {
  connectionDayNumber,
  isPlanWindowOpen,
  isReadyToMeetAvailable,
  isSharedActivityAvailable,
  planWindowDaysRemaining,
} from '@/lib/matchmaker/connection';

export type ConnectionMilestoneId =
  | 'connected'
  | 'first_message'
  | 'shared_activity'
  | 'check_in'
  | 'plan_window';

export type MilestoneVisualState = 'completed' | 'current' | 'future';

export type ConnectionMilestone = {
  id: ConnectionMilestoneId;
  label: string;
  detail?: string;
  state: MilestoneVisualState;
};

function formatShortDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function planWindowUnlockDayFromFirstMessage(firstMessageAt: string | null, now = Date.now()): number | null {
  if (!firstMessageAt) return null;
  const start = new Date(firstMessageAt).getTime();
  if (Number.isNaN(start)) return null;
  const day = Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, 21 - day + 1);
}

export function lockedFeatureUnlockDay(
  feature: 'shared_activity' | 'ready_to_meet' | 'plan_window',
  connection: MatchMakerConnectionRow,
  now = Date.now()
): number | null {
  if (feature === 'shared_activity') {
    const day = connectionDayNumber(connection.connected_at, now);
    return day >= 7 ? null : 7;
  }
  if (feature === 'ready_to_meet') {
    const day = connectionDayNumber(connection.connected_at, now);
    return day >= 10 ? null : 10;
  }
  if (!connection.first_message_at) return 21;
  const unlockDay = planWindowUnlockDayFromFirstMessage(connection.first_message_at, now);
  if (unlockDay == null) return 21;
  if (isPlanWindowOpen(connection, now)) return null;
  const daysLeft = planWindowDaysRemaining(connection.plan_unlock_at, now);
  if (daysLeft == null) return 21;
  const msgDay = connectionDayNumber(connection.first_message_at, now);
  return msgDay + daysLeft;
}

export function buildConnectionMilestones(
  connection: MatchMakerConnectionRow,
  options?: { sharedActivityDone?: boolean; now?: number }
): ConnectionMilestone[] {
  const now = options?.now ?? Date.now();
  const day = connectionDayNumber(connection.connected_at, now);
  const planOpen = isPlanWindowOpen(connection, now);
  const sharedReady = isSharedActivityAvailable(connection.connected_at, now);
  const checkInReady = isReadyToMeetAvailable(connection.connected_at, now);

  const connectedDone = true;
  const firstMessageDone = !!connection.first_message_at;
  const sharedDone = !!options?.sharedActivityDone;
  const checkInDone = day >= 10;
  const planDone = planOpen;

  const raw: { id: ConnectionMilestoneId; label: string; detail?: string; done: boolean; eligible: boolean }[] = [
    {
      id: 'connected',
      label: 'Connected',
      detail: formatShortDate(connection.connected_at),
      done: connectedDone,
      eligible: true,
    },
    {
      id: 'first_message',
      label: 'First message',
      detail: formatShortDate(connection.first_message_at),
      done: firstMessageDone,
      eligible: true,
    },
    {
      id: 'shared_activity',
      label: 'Day 7: Shared Activity',
      done: sharedDone,
      eligible: sharedReady,
    },
    {
      id: 'check_in',
      label: 'Day 10: Check-in',
      done: checkInDone,
      eligible: checkInReady,
    },
    {
      id: 'plan_window',
      label: 'Plan window',
      detail: planOpen ? 'Open' : connection.first_message_at ? undefined : 'Starts after first message',
      done: planDone,
      eligible: !!connection.first_message_at,
    },
  ];

  let currentAssigned = false;
  return raw.map((m) => {
    let state: MilestoneVisualState;
    if (m.done) {
      state = 'completed';
    } else if (!currentAssigned && m.eligible) {
      state = 'current';
      currentAssigned = true;
    } else {
      state = 'future';
    }
    return { id: m.id, label: m.label, detail: m.detail, state };
  });
}
