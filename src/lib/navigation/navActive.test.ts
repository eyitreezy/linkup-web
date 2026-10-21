import { describe, expect, it } from 'vitest';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import {
  MATCHMAKER_NAV_ICON_ACTIVE_SRC,
  MATCHMAKER_NAV_ICON_INACTIVE_SRC,
  matchMakerNavIconSrc,
} from '@/lib/navigation/matchmakerNavIcon';

describe('isMainNavItemActive', () => {
  it('highlights MatchMaker tab on connection screen', () => {
    expect(isMainNavItemActive('/matchmaker/connection/abc-123', '/matchmaker')).toBe(true);
  });

  it('highlights MatchMaker tab on settings and values sub-routes', () => {
    expect(isMainNavItemActive('/matchmaker/settings', '/matchmaker')).toBe(true);
    expect(isMainNavItemActive('/matchmaker/values', '/matchmaker')).toBe(true);
    expect(isMainNavItemActive('/matchmaker/history', '/matchmaker')).toBe(true);
  });

  it('does not highlight MatchMaker tab outside MatchMaker routes', () => {
    expect(isMainNavItemActive('/discover', '/matchmaker')).toBe(false);
  });

  it('does not highlight Discover when on MatchMaker values (standalone sub-route)', () => {
    expect(isMainNavItemActive('/matchmaker/values', '/discover')).toBe(false);
  });
});

describe('matchMakerNavIconSrc', () => {
  it('returns supplied active and inactive navigation assets', () => {
    expect(matchMakerNavIconSrc(true)).toBe(MATCHMAKER_NAV_ICON_ACTIVE_SRC);
    expect(matchMakerNavIconSrc(false)).toBe(MATCHMAKER_NAV_ICON_INACTIVE_SRC);
  });

  it('aligns icon state with MatchMaker route detection', () => {
    const pathname = '/matchmaker/values?step=3';
    const pathOnly = pathname.split('?')[0]!;
    const active = isMainNavItemActive(pathOnly, '/matchmaker');
    expect(active).toBe(true);
    expect(matchMakerNavIconSrc(active)).toBe(MATCHMAKER_NAV_ICON_ACTIVE_SRC);
    expect(matchMakerNavIconSrc(isMainNavItemActive('/messages', '/matchmaker'))).toBe(
      MATCHMAKER_NAV_ICON_INACTIVE_SRC
    );
  });
});
