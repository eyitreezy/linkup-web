/** Routes that are not main shell tabs — no Discover/Messages/etc. highlight. */
function isPlanSubRoute(pathname: string): boolean {
  return pathname === '/plan' || pathname.startsWith('/plan/');
}

export function isPremiumRoute(pathname: string): boolean {
  return pathname === '/subscription' || pathname.startsWith('/subscription/');
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function isStandaloneAppRoute(pathname: string): boolean {
  if (isPremiumRoute(pathname) || isAdminRoute(pathname)) return true;
  if (isPlanSubRoute(pathname)) return true;
  const prefixes = [
    '/trust',
    '/kyc',
    '/support',
    '/notifications',
    '/escrow/',
    '/dispute',
    '/disputes',
    '/chat/',
  ];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Whether a main sidebar/bottom nav item should show as active.
 * Premium is profile-linked only (not a tab). Admin uses its own nav item.
 */
export function isProfileRoute(pathname: string): boolean {
  return pathname === '/profile' || pathname.startsWith('/profile/');
}

export function isMainNavItemActive(pathname: string, href: string): boolean {
  if (href === '/profile') return isProfileRoute(pathname);
  if (isPremiumRoute(pathname)) return false;
  if (isAdminRoute(pathname)) return href === '/admin';
  if (isProfileRoute(pathname)) return false;
  if (isStandaloneAppRoute(pathname) && !isAdminRoute(pathname)) return false;
  if (href === '/admin') return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
