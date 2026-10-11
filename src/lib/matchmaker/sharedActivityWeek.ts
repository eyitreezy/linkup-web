import { SHARED_ACTIVITY_MAX_WEEKS } from '@/lib/matchmaker/sharedActivityCatalog';

/** Whole days since connection start (0 on connection day 1). */
export function connectionDaysElapsed(connectedAt: string, now = Date.now()): number {
  const start = new Date(connectedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 86400000));
}

/** Week 1 unlocks on connection day 7 (days elapsed >= 6). */
export function maxUnlockedActivityWeek(connectedAt: string, now = Date.now()): number {
  const days = connectionDaysElapsed(connectedAt, now);
  if (days < 6) return 0;
  const week = 1 + Math.floor((days - 6) / 7);
  return Math.min(SHARED_ACTIVITY_MAX_WEEKS, week);
}

export function isActivityWeekUnlocked(connectedAt: string, weekNumber: number, now = Date.now()): boolean {
  if (weekNumber < 1 || weekNumber > SHARED_ACTIVITY_MAX_WEEKS) return false;
  const days = connectionDaysElapsed(connectedAt, now);
  return days >= 6 + (weekNumber - 1) * 7;
}

export function isSharedActivityAvailable(connectedAt: string, now = Date.now()): boolean {
  return maxUnlockedActivityWeek(connectedAt, now) >= 1;
}

/** Prefer first unlocked week the user has not submitted (for default route). */
export function defaultActivityWeekToOpen(
  connectedAt: string,
  submittedWeeks: number[],
  now = Date.now()
): number {
  const max = maxUnlockedActivityWeek(connectedAt, now);
  if (max < 1) return 1;
  for (let w = 1; w <= max; w += 1) {
    if (!submittedWeeks.includes(w)) return w;
  }
  return max;
}
