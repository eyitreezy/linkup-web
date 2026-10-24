import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';

/**
 * MatchMaker icon color guide (interaction spec VISUAL IDENTITY + main nav parity).
 *
 * | Tone            | Fill        | Artwork   | Typical use                          |
 * |-----------------|-------------|-----------|--------------------------------------|
 * | nav-inactive    | #6B7280     | inactive  | Sidebar / bottom nav (unselected)    |
 * | nav-active      | #FFFFFF     | active    | Nav on gradient / purple tab         |
 * | accent          | #9B1B4B     | active    | Pool headers (on gradient), chat CTA |
 * | accent-muted    | #9B1B4B @70%| active    | Gate modal, empty pool               |
 * | accent-soft     | #9B1B4B @50%| active    | Reflection, quiet emotional beats    |
 * | accent-strong   | #9B1B4B @80%| active    | Re-entry, reaffirmation hero         |
 * | muted           | #6B7280     | inactive  | De-emphasized MatchMaker marks       |
 * | on-primary      | #FFFFFF     | active    | Badges on accent / gradient buttons  |
 */
export const MATCHMAKER_ICON_NAV_INACTIVE = '#6B7280';

export type MatchMakerIconTone =
  | 'nav-active'
  | 'nav-inactive'
  | 'accent'
  | 'accent-muted'
  | 'accent-soft'
  | 'accent-strong'
  | 'muted'
  | 'on-primary';

export function matchMakerIconArtwork(tone: MatchMakerIconTone): 'active' | 'inactive' {
  if (tone === 'nav-inactive' || tone === 'muted') return 'inactive';
  return 'active';
}

export function matchMakerIconFill(tone: MatchMakerIconTone): string {
  switch (tone) {
    case 'nav-active':
    case 'on-primary':
      return '#FFFFFF';
    case 'nav-inactive':
    case 'muted':
      return MATCHMAKER_ICON_NAV_INACTIVE;
    case 'accent':
    case 'accent-muted':
    case 'accent-soft':
    case 'accent-strong':
      return MATCHMAKER_THEME.accent;
    default:
      return MATCHMAKER_THEME.accent;
  }
}

export function matchMakerIconOpacityClass(tone: MatchMakerIconTone): string | undefined {
  switch (tone) {
    case 'accent-muted':
      return 'opacity-70';
    case 'accent-soft':
      return 'opacity-50';
    case 'accent-strong':
      return 'opacity-80';
    default:
      return undefined;
  }
}

export function matchMakerIconToneFromNavActive(active: boolean): MatchMakerIconTone {
  return active ? 'nav-active' : 'nav-inactive';
}
