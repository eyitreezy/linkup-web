import { describe, expect, it } from 'vitest';
import { isMainNavItemActive } from '@/lib/navigation/navActive';

describe('isMainNavItemActive', () => {
  it('highlights MatchMaker tab on connection screen', () => {
    expect(isMainNavItemActive('/matchmaker/connection/abc-123', '/matchmaker')).toBe(true);
  });

  it('does not highlight MatchMaker tab on settings sub-route', () => {
    expect(isMainNavItemActive('/matchmaker/settings', '/matchmaker')).toBe(false);
  });
});
