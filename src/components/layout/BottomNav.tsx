'use client';

import { BottomNavMoreButton, BottomNavMoreSheet } from '@/components/navigation/BottomNavMoreSheet';
import { NavItemUnreadIndicator } from '@/components/navigation/NavItemUnreadIndicator';
import { TabIcon } from '@/components/navigation/TabIcon';
import { BottomNavAccountButton } from '@/components/navigation/BottomNavAccountButton';
import {
  ADMIN_NAV_ITEM,
  MOBILE_TAB_NAV,
  PROFILE_NAV_ITEM,
  splitBottomNavItems,
  type NavTabItem,
} from '@/components/navigation/tabNavConfig';
import { useBottomNavVisibleCount } from '@/hooks/use-bottom-nav-visible-count';
import { useIsMobileShellLayout } from '@/hooks/use-media-query';
import { useMessagesInboxOptional } from '@/contexts/MessagesInboxContext';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type MouseEvent } from 'react';

const INACTIVE = '#6B7280';

function BottomNavTabLink({
  item,
  active,
  unreadCount,
  showDot,
  onNavigate,
}: {
  item: NavTabItem;
  active: boolean;
  unreadCount: number;
  showDot: boolean;
  onNavigate?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-0.5 transition active:scale-95 min-[360px]:gap-1',
        active ? 'text-primary' : 'text-[#6B7280]'
      )}
      style={{ color: active ? undefined : INACTIVE }}
    >
      <NavItemUnreadIndicator
        count={unreadCount}
        showDot={showDot}
        active={active}
        ringClassName="ring-surface/95"
      >
        <TabIcon
          name={item.icon}
          size={18}
          className={cn('min-[360px]:hidden', active ? 'text-primary' : 'text-[#6B7280]')}
        />
        <TabIcon
          name={item.icon}
          size={20}
          className={cn('hidden min-[360px]:block min-[400px]:hidden', active ? 'text-primary' : 'text-[#6B7280]')}
        />
        <TabIcon
          name={item.icon}
          size={22}
          className={cn('hidden min-[400px]:block min-[480px]:hidden', active ? 'text-primary' : 'text-[#6B7280]')}
        />
        <TabIcon
          name={item.icon}
          size={24}
          className={cn('hidden min-[480px]:block', active ? 'text-primary' : 'text-[#6B7280]')}
        />
      </NavItemUnreadIndicator>
      <span className="w-full max-w-[3.25rem] truncate text-center text-[8px] font-semibold leading-tight tracking-tight min-[360px]:max-w-[4rem] min-[360px]:text-[9px] min-[400px]:max-w-[4.75rem] min-[400px]:text-[10px] min-[480px]:max-w-none">
        {item.label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobileShell = useIsMobileShellLayout();
  const messagesInbox = useMessagesInboxOptional();
  const { isAdmin } = useAdminAccess();
  const [moreOpen, setMoreOpen] = useState(false);
  const maxVisible = useBottomNavVisibleCount();

  const navItems = isAdmin ? [...MOBILE_TAB_NAV, ADMIN_NAV_ITEM] : [...MOBILE_TAB_NAV];
  const { primary, overflow } = useMemo(
    () => splitBottomNavItems(navItems, maxVisible),
    [navItems, maxVisible]
  );

  const moreActive = useMemo(
    () => overflow.some((item) => isMainNavItemActive(pathname, item.href)),
    [overflow, pathname]
  );

  const accountActive = isMainNavItemActive(pathname, PROFILE_NAV_ITEM.href);
  const barSlots = [
    ...primary,
    { id: 'account' as const },
    ...(overflow.length > 0 ? [{ id: 'more' as const }] : []),
  ];

  function unreadFor(item: NavTabItem) {
    if (item.href === '/messages') return messagesInbox?.unreadCount ?? 0;
    return 0;
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:left-[240px] lg:hidden xl:left-[260px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Main navigation"
      >
        <div className="flex h-[3px]">
          {barSlots.map((slot) => {
            const isMore = 'id' in slot && slot.id === 'more';
            const isAccount = 'id' in slot && slot.id === 'account';
            const active = isMore
              ? moreActive
              : isAccount
                ? accountActive
                : isMainNavItemActive(pathname, (slot as NavTabItem).href);
            return (
              <div
                key={isMore ? 'more' : isAccount ? 'account' : (slot as NavTabItem).href}
                className="flex min-w-0 flex-1"
              >
                {active ? <div className="h-full w-full bg-primary" /> : <div className="h-full w-full" />}
              </div>
            );
          })}
        </div>
        <ul className="flex min-w-0 items-start justify-around gap-0 px-0.5 pt-1.5">
          {primary.map((item) => {
            const active = isMainNavItemActive(pathname, item.href);
            const isMessages = item.href === '/messages';
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <BottomNavTabLink
                  item={item}
                  active={active}
                  unreadCount={unreadFor(item)}
                  showDot={isMessages}
                  onNavigate={
                    isMessages && isMobileShell
                      ? (e) => {
                          e.preventDefault();
                          router.replace('/messages', { scroll: false });
                        }
                      : undefined
                  }
                />
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <BottomNavAccountButton />
          </li>
          {overflow.length > 0 ? (
            <li className="min-w-0 flex-1">
              <BottomNavMoreButton active={moreActive || moreOpen} onClick={() => setMoreOpen(true)} />
            </li>
          ) : null}
        </ul>
      </nav>

      <BottomNavMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={overflow} />
    </>
  );
}
