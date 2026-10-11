import { describe, expect, it } from 'vitest';
import {
  connectionDaysElapsed,
  isActivityWeekUnlocked,
  isSharedActivityAvailable,
  maxUnlockedActivityWeek,
} from '@/lib/matchmaker/sharedActivityWeek';

const DAY_MS = 86400000;

function connectedAtDaysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString();
}

describe('sharedActivityWeek', () => {
  it('treats connection day 6 as locked and day 7 as available', () => {
    expect(isSharedActivityAvailable(connectedAtDaysAgo(5))).toBe(false);
    expect(isSharedActivityAvailable(connectedAtDaysAgo(6))).toBe(true);
    expect(maxUnlockedActivityWeek(connectedAtDaysAgo(5))).toBe(0);
    expect(maxUnlockedActivityWeek(connectedAtDaysAgo(6))).toBe(1);
  });

  it('unlocks week 2 after 13 full days elapsed from connect (day 14)', () => {
    const at = connectedAtDaysAgo(13);
    expect(connectionDaysElapsed(at)).toBe(13);
    expect(isActivityWeekUnlocked(at, 1)).toBe(true);
    expect(isActivityWeekUnlocked(at, 2)).toBe(true);
    expect(maxUnlockedActivityWeek(at)).toBe(2);
  });

  it('caps catalog at eight weeks', () => {
    expect(maxUnlockedActivityWeek(connectedAtDaysAgo(200))).toBe(8);
  });
});
