import { describe, expect, it } from 'vitest';
import { isMatchMakerConnectionTabRoute } from '@/stores/matchmaker-tab-store';

describe('matchmaker tab routes', () => {
  it('detects connection tab routes', () => {
    expect(isMatchMakerConnectionTabRoute('/matchmaker')).toBe(true);
    expect(isMatchMakerConnectionTabRoute('/matchmaker/connection/x')).toBe(true);
    expect(isMatchMakerConnectionTabRoute('/matchmaker/connection/x/activity')).toBe(false);
  });
});
