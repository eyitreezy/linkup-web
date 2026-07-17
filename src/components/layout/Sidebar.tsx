'use client';

import { LinkUpLogo } from '@/components/brand/LinkUpLogo';
import { NavItemUnreadIndicator } from '@/components/navigation/NavItemUnreadIndicator';
import { TabIcon } from '@/components/navigation/TabIcon';
import { ADMIN_NAV_ITEM, MOBILE_TAB_NAV } from '@/components/navigation/tabNavConfig';
import { useMessagesInboxOptional } from '@/contexts/MessagesInboxContext';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { APP_SPLASH_BACKGROUND } from '@/lib/brand';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import { shouldPrefetchNavRoute } from '@/lib/navigation/prefetchNav';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { SidebarProfileFooter } from '@/components/layout/SidebarProfileFooter';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const messagesInbox = useMessagesInboxOptional();
  const { isAdmin } = useAdminAccess();

  const navItems = isAdmin ? [...MOBILE_TAB_NAV, ADMIN_NAV_ITEM] : [...MOBILE_TAB_NAV];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 hidden h-screen w-[240px] flex-col isolate',
        'border-r border-border px-4 py-6 lg:flex xl:w-[260px]'
      )}
      style={{ backgroundColor: APP_SPLASH_BACKGROUND }}
    >
      <Link
        href="/discover"
        className="relative isolate mb-8 block shrink-0 px-3"
        style={{ backgroundColor: APP_SPLASH_BACKGROUND }}
        aria-label="LinkUp home"
      >
        <LinkUpLogo width={118} />
      </Link>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isMainNavItemActive(pathname, item.href);
          const isMessages = item.href === '/messages';
          const unreadCount = isMessages ? (messagesInbox?.unreadCount ?? 0) : 0;
          const showDot = isMessages;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={shouldPrefetchNavRoute(item.href)}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-bold transition',
                active
                  ? 'linkup-gradient-primary text-white shadow-md'
                  : 'text-muted hover:bg-[#EDE8FF]/60 hover:text-foreground'
              )}
            >
              <NavItemUnreadIndicator
                count={unreadCount}
                showDot={showDot}
                active={active}
                ringClassName={active ? 'ring-white' : 'ring-surface'}
              >
                <TabIcon
                  name={item.icon}
                  size={20}
                  className={active ? 'text-white' : 'text-muted'}
                />
              </NavItemUnreadIndicator>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <SidebarProfileFooter />
    </aside>
  );
}
