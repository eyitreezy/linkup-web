/**
 * Shared layout tokens for the three-column AppShell.
 * Values mirror CSS custom properties in globals.css.
 */
export const LINKUP_LAYOUT = {
  sidebarLeftLg: '240px',
  sidebarLeftXl: '260px',
  contextRailWidth: '300px',
  mainContentMaxWidth: '56rem',
  mainContentMaxWidthWide: '72rem',
} as const;

export const LINKUP_MAIN_CONTENT_INNER_CLASS = 'linkup-main-content-inner';
export const LINKUP_MAIN_CONTENT_INNER_WIDE_CLASS = 'linkup-main-content-inner--wide';

/** Horizontal gutters — mirrors AppShell `linkup-main-content-inner` padding. */
export const LINKUP_MAIN_CONTENT_GUTTER_CLASS =
  'px-4 md:px-6 max-[424px]:px-2 max-[374px]:px-1.5 max-[359px]:px-1';

/** Pair with gutter class to bleed section backgrounds across the shell padding band. */
export const LINKUP_MAIN_CONTENT_GUTTER_BLEED_CLASS =
  '-mx-4 md:-mx-6 max-[424px]:-mx-2 max-[374px]:-mx-1.5 max-[359px]:-mx-1';

/** Default tab page column rhythm (Discover, Meetr, MatchMaker, etc.). */
export const LINKUP_TAB_PAGE_SHELL_CLASS =
  'linkup-page-shell min-w-0 w-full max-w-full space-y-4 pb-10 min-[360px]:space-y-6 min-[400px]:space-y-8 lg:space-y-8 lg:pb-10';
