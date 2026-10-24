import { describe, expect, it } from 'vitest';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import { lockedFeatureUnlockMessage } from '@/lib/matchmaker/connectionTimeline';

function conn(partial: Partial<MatchMakerConnectionRow>): MatchMakerConnectionRow {
  return {
    id: 'c1',
    user_a_id: 'a',
    user_b_id: 'b',
    status: 'active',
    connected_at: '2026-01-01T12:00:00.000Z',
    first_message_at: null,
    plan_unlock_at: null,
    ended_at: null,
    first_plan_created_at: null,
    ...partial,
  };
}

describe('lockedFeatureUnlockMessage plan_window', () => {
  it('prompts for first message when none sent', () => {
    const message = lockedFeatureUnlockMessage('plan_window', conn({}));
    expect(message).toContain('first message');
  });

  it('uses days remaining until plan_unlock_at, not connection day sum', () => {
    const now = new Date('2026-01-10T12:00:00.000Z').getTime();
    const first = '2026-01-01T12:00:00.000Z';
    const unlock = '2026-01-15T12:00:00.000Z';
    const message = lockedFeatureUnlockMessage(
      'plan_window',
      conn({ first_message_at: first, plan_unlock_at: unlock }),
      now
    );
    expect(message).toBe('Your plan window opens in 5 days.');
  });
});
