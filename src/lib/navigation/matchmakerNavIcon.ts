export const MATCHMAKER_NAV_ICON_ACTIVE_SRC = '/navigation/matchmaker-active.png';
export const MATCHMAKER_NAV_ICON_INACTIVE_SRC = '/navigation/matchmaker-inactive.png';

export function matchMakerNavIconSrc(active: boolean): string {
  return active ? MATCHMAKER_NAV_ICON_ACTIVE_SRC : MATCHMAKER_NAV_ICON_INACTIVE_SRC;
}

/** Whether pathname is under the MatchMaker product area (pool, onboarding, settings, etc.). */
export function isMatchMakerProductRoute(pathname: string): boolean {
  return pathname === '/matchmaker' || pathname.startsWith('/matchmaker/');
}
