import type { NavTabItem } from '@/components/navigation/tabNavConfig';

/**
 * Order tabs stay in the bottom bar as width allows (highest priority first).
 * Overflow tabs open from the ⋯ sheet.
 */
export const BOTTOM_NAV_BAR_PRIORITY = [
  '/discover',
  '/messages',
  '/plans',
  '/offers',
  '/plan-management',
  '/wallet',
  '/admin',
] as const;

/** Show up to 5 tabs before ⋯ on wide mobile; fewer as the viewport narrows (down to 320px). */
export function bottomNavMaxVisibleForWidth(width: number): number {
  if (width >= 480) return 5;
  if (width >= 400) return 4;
  if (width >= 360) return 4;
  return 3;
}

function priorityIndex(href: string): number {
  const i = (BOTTOM_NAV_BAR_PRIORITY as readonly string[]).indexOf(href);
  return i === -1 ? 999 : i;
}

export function splitBottomNavItems(items: readonly NavTabItem[], maxVisible: number) {
  const sorted = [...items].sort((a, b) => priorityIndex(a.href) - priorityIndex(b.href));

  if (sorted.length <= maxVisible) {
    return { primary: sorted, overflow: [] as NavTabItem[] };
  }

  return {
    primary: sorted.slice(0, maxVisible),
    overflow: sorted.slice(maxVisible),
  };
}
