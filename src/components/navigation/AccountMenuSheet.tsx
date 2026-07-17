'use client';

import { NavItemUnreadIndicator } from '@/components/navigation/NavItemUnreadIndicator';
import { TabIcon } from '@/components/navigation/TabIcon';
import { PROFILE_NAV_ITEM } from '@/components/navigation/tabNavConfig';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { signOutAndRedirect } from '@/lib/auth/signOut';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import { cn } from '@/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IoClose, IoLogOutOutline } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export function AccountMenuSheet({ open, onClose, title = 'Your account' }: Props) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const notificationInbox = useNotificationInboxOptional();
  const unreadCount = notificationInbox?.unreadCount ?? 0;
  const [signingOut, setSigningOut] = useState(false);
  const profileActive = isMainNavItemActive(pathname, PROFILE_NAV_ITEM.href);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function signOut() {
    setSigningOut(true);
    onClose();
    await signOutAndRedirect({ queryClient });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] lg:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl lg:rounded-3xl"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
          <p className="font-display text-lg font-extrabold text-foreground">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-2 text-muted hover:bg-[#EDE8FF]/50"
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </div>
        <div className="space-y-1 p-3">
          <Link
            href={PROFILE_NAV_ITEM.href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-extrabold transition',
              profileActive
                ? 'linkup-gradient-primary text-white shadow-md'
                : 'text-foreground hover:bg-[#EDE8FF]/60'
            )}
          >
            <NavItemUnreadIndicator
              count={unreadCount}
              showDot
              active={profileActive}
              ringClassName={profileActive ? 'ring-white' : 'ring-surface'}
            >
              <TabIcon
                name={PROFILE_NAV_ITEM.icon}
                size={22}
                className={profileActive ? 'text-white' : 'text-primary'}
              />
            </NavItemUnreadIndicator>
            View profile
            {unreadCount > 0 ? (
              <span
                className={cn(
                  'ml-auto rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                  profileActive ? 'bg-white/25 text-white' : 'bg-secondary text-white'
                )}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-extrabold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            <IoLogOutOutline size={22} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
