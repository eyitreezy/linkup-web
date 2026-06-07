'use client';

import { AccountMenuSheet } from '@/components/navigation/AccountMenuSheet';
import { NavItemUnreadIndicator } from '@/components/navigation/NavItemUnreadIndicator';
import { TabIcon } from '@/components/navigation/TabIcon';
import { PROFILE_NAV_ITEM } from '@/components/navigation/tabNavConfig';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { createClient } from '@/lib/supabase/client';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoChevronUp, IoLogOutOutline } from 'react-icons/io5';

export function SidebarProfileFooter() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const notificationInbox = useNotificationInboxOptional();
  const unreadCount = notificationInbox?.unreadCount ?? 0;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const profileActive = isMainNavItemActive(pathname, PROFILE_NAV_ITEM.href);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (!user) return null;

  const profile = data?.profile ?? null;
  const name = profile?.display_name?.trim() || user.email?.split('@')[0] || 'You';
  const email = user.email ?? '';
  const avatar = profile?.avatar_url ?? profile?.photo_urls?.[0] ?? null;

  async function signOut() {
    setSigningOut(true);
    const client = createClient();
    await client.auth.signOut();
    queryClient.clear();
    setOpen(false);
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mt-auto shrink-0 border-t border-border/80 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
          open
            ? 'border-primary/25 bg-gradient-to-br from-[#EDE8FF] to-white shadow-sm'
            : 'border-transparent hover:border-primary/15 hover:bg-[#EDE8FF]/40'
        )}
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#EDE8FF] shadow-md ring-2 ring-primary/15">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-lg font-extrabold text-primary">{name.charAt(0).toUpperCase()}</span>
          )}
          {unreadCount > 0 ? (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-secondary ring-2 ring-white" aria-hidden />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          {isLoading ? (
            <>
              <span className="block h-4 w-24 animate-pulse rounded-md bg-[#EDE8FF]" />
              <span className="mt-1.5 block h-3 w-32 animate-pulse rounded-md bg-[#FFF0F5]/80" />
            </>
          ) : (
            <>
              <span className="block truncate text-[14px] font-extrabold text-foreground">{name}</span>
              <span className="block truncate text-[11px] font-semibold text-muted">{email}</span>
            </>
          )}
        </span>
        <IoChevronUp
          size={18}
          className={cn('shrink-0 text-muted transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out',
          open ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-1 rounded-2xl border border-border/80 bg-[#FAFBFF] p-2">
            <Link
              href={PROFILE_NAV_ITEM.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-extrabold transition',
                profileActive
                  ? 'linkup-gradient-primary text-white shadow-sm'
                  : 'text-muted hover:bg-white hover:text-foreground'
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
                  size={20}
                  className={profileActive ? 'text-white' : 'text-primary'}
                />
              </NavItemUnreadIndicator>
              View profile
              {unreadCount > 0 ? (
                <span
                  className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold',
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
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-extrabold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <IoLogOutOutline size={18} />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
