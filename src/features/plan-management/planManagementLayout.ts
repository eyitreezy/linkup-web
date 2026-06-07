/**
 * Plan management layout class names.
 * Chip row layout is defined in plan-management.css (flex-wrap, content-sized).
 */

export const pmShell =
  'plan-mgmt linkup-page-shell w-full min-w-0 max-w-full lg:space-y-6 max-lg:space-y-0';

export const pmShellPb = 'pb-10 max-[424px]:pb-8 max-[359px]:pb-7';

/** Section filters — flex-wrap, content-sized pills (same at 320px and 425px). */
export const pmSectionChipScroller = 'pm-filter-section pm-chip-row';

/** Sort chips — flex-wrap, content-sized. */
export const pmSortChipRow = 'pm-sort-section pm-chip-row';

/** Card action row — flex-wrap, content-sized. */
export const pmActionScroller = 'pm-card-actions pm-chip-row';

export const pmChipBase =
  'pm-chip-tap inline-flex shrink-0 grow-0 basis-auto items-center rounded-full font-extrabold transition active:scale-[0.98] px-3.5 py-2 text-[14px]';

export const pmActionBtn =
  'pm-action-tap inline-flex shrink-0 grow-0 basis-auto items-center rounded-full bg-primary/10 font-extrabold text-primary transition hover:bg-primary/15 px-3.5 py-2 text-[14px]';
