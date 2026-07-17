/** Heavy routes — skip Next.js link prefetch to reduce background JS on tab bar. */
const HEAVY_NAV_ROUTES = new Set(['/plan-management', '/offers', '/admin']);

export function shouldPrefetchNavRoute(href: string): boolean {
  return !HEAVY_NAV_ROUTES.has(href);
}
