export type TabIconName =
  | 'heart'
  | 'chatbubbles'
  | 'bookmark'
  | 'albums'
  | 'pricetag'
  | 'wallet'
  | 'person'
  | 'shield';

/**
 * Main shell tabs — profile is via sidebar account menu (desktop) or bottom Account (mobile).
 * Mirrors mobile tab order except profile (web-only entry point).
 */
export const MOBILE_TAB_NAV = [
  { href: '/discover', label: 'Discover', icon: 'heart' as TabIconName },
  { href: '/messages', label: 'Messages', icon: 'chatbubbles' as TabIconName },
  { href: '/plans', label: 'Saved', icon: 'bookmark' as TabIconName },
  { href: '/plan-management', label: 'Manage', icon: 'albums' as TabIconName },
  { href: '/offers', label: 'Offers', icon: 'pricetag' as TabIconName },
  { href: '/wallet', label: 'Wallet', icon: 'wallet' as TabIconName },
] as const;

/** Profile — not in MOBILE_TAB_NAV; linked from account menu with notification badge. */
export const PROFILE_NAV_ITEM = {
  href: '/profile',
  label: 'Profile',
  icon: 'person' as TabIconName,
} as const;

/**
 * Sidebar / mobile bottom bar — only for users in `public.admins`.
 * Not shown on Profile (matches product: admin is an ops surface, not account settings).
 */
export const ADMIN_NAV_ITEM = {
  href: '/admin',
  label: 'Admin',
  icon: 'shield' as TabIconName,
} as const;

/** Intentionally omitted from MOBILE_TAB_NAV — open via Profile card, paywalls, and deep links. */
export const PREMIUM_HREF = '/premium' as const;

export type NavTabItem = (typeof MOBILE_TAB_NAV)[number] | typeof ADMIN_NAV_ITEM;

export { bottomNavMaxVisibleForWidth, splitBottomNavItems } from '@/lib/navigation/bottomNavSplit';
