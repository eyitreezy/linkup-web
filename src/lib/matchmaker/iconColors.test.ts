import { describe, expect, it } from 'vitest';
import {
  MATCHMAKER_ICON_NAV_INACTIVE,
  matchMakerIconFill,
  matchMakerIconToneFromNavActive,
} from '@/lib/matchmaker/iconColors';

describe('matchMaker icon color guide', () => {
  it('uses #6B7280 for nav-inactive and muted tones', () => {
    expect(MATCHMAKER_ICON_NAV_INACTIVE).toBe('#6B7280');
    expect(matchMakerIconFill('nav-inactive')).toBe('#6B7280');
    expect(matchMakerIconFill('muted')).toBe('#6B7280');
  });

  it('maps nav active state to white fill', () => {
    expect(matchMakerIconToneFromNavActive(true)).toBe('nav-active');
    expect(matchMakerIconFill('nav-active')).toBe('#FFFFFF');
    expect(matchMakerIconToneFromNavActive(false)).toBe('nav-inactive');
  });

  it('uses MatchMaker accent for brand tones', () => {
    expect(matchMakerIconFill('accent')).toBe('#9B1B4B');
    expect(matchMakerIconFill('accent-muted')).toBe('#9B1B4B');
  });
});
