'use client';

import { AccountMenuSheet } from '@/components/navigation/AccountMenuSheet';
import { NavItemUnreadIndicator } from '@/components/navigation/NavItemUnreadIndicator';
import { TabIcon } from '@/components/navigation/TabIcon';
import { PROFILE_NAV_ITEM } from '@/components/navigation/tabNavConfig';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import { cn } from '@/utils/cn';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const INACTIVE = '#6B7280';

/** Mobile bottom bar account access (profile tab removed from main nav). */
export function BottomNavAccountButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const notificationInbox = useNotificationInboxOptional();
  const unreadCount = notificationInbox?.unreadCount ?? 0;
  const active = isMainNavItemActive(pathname, PROFILE_NAV_ITEM.href) || open;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Your account"
        className={cn(
          'flex w-full flex-col items-center gap-0.5 px-0.5 py-0.5 transition active:scale-95 min-[360px]:gap-1',
          active ? 'text-primary' : 'text-[#6B7280]'
        )}
        style={{ color: active ? undefined : INACTIVE }}
      >
        <NavItemUnreadIndicator count={unreadCount} showDot active={active} ringClassName="ring-surface/95">
          <TabIcon
            name={PROFILE_NAV_ITEM.icon}
            size={20}
            className={cn('min-[360px]:hidden', active ? 'text-primary' : 'text-[#6B7280]')}
          />
          <TabIcon
            name={PROFILE_NAV_ITEM.icon}
            size={22}
            className={cn('hidden min-[360px]:block', active ? 'text-primary' : 'text-[#6B7280]')}
          />
        </NavItemUnreadIndicator>
        <span className="w-full max-w-[4.25rem] truncate text-center text-[9px] font-semibold leading-tight tracking-tight min-[360px]:text-[10px]">
          Account
        </span>
      </button>
      <AccountMenuSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
