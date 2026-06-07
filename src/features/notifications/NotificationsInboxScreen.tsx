'use client';

import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { NOTIFICATIONS_QUERY_KEY } from '@/lib/notifications/queryKeys';
import { invalidateNotificationQueries } from '@/lib/notifications/invalidate';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import {
  FILTER_LABELS,
  FILTER_TAB_ORDER,
  notificationMatchesFilter,
  type NotificationFilterTab,
} from '@/lib/notifications/categories';
import { navigateFromNotification } from '@/lib/notifications/navigateFromNotification';
import {
  deleteNotification,
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbNotification } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IoNotificationsOutline, IoPricetagOutline, IoSettingsOutline, IoTrashOutline } from 'react-icons/io5';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sortNotifications(list: DbNotification[]): DbNotification[] {
  const pr: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...list].sort(
    (a, b) =>
      pr[a.priority] - pr[b.priority] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function NotificationsInboxScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilterTab>('all');

  const inbox = useNotificationInboxOptional();
  const unreadFromList = inbox?.unreadCount;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return { rows: [] as DbNotification[], error: null };
      return fetchUserNotifications(user.id);
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const notifications = data?.rows ?? [];
  const unreadCount =
    unreadFromList ?? notifications.filter((n) => !n.is_read).length;
  const hasUnread = unreadCount > 0;

  const filtered = useMemo(() => {
    const list = notifications.filter((n) => notificationMatchesFilter(n, filter));
    return sortNotifications(list);
  }, [notifications, filter]);

  const filterEmpty = filter !== 'all' && notifications.length > 0 && filtered.length === 0;

  const sections = useMemo(() => {
    const t0 = startOfToday();
    const today: DbNotification[] = [];
    const earlier: DbNotification[] = [];
    for (const n of filtered) {
      if (new Date(n.created_at).getTime() >= t0) today.push(n);
      else earlier.push(n);
    }
    const out: { title: string; items: DbNotification[] }[] = [];
    if (today.length) out.push({ title: 'Today', items: today });
    if (earlier.length) out.push({ title: 'Earlier', items: earlier });
    return out;
  }, [filtered]);

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view notifications.
      </p>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <SettingsPageHeader
        kicker="Inbox"
        title="Notifications"
        subtitle="Offers, escrow, and updates — sorted by what matters first."
        actions={
          <div className="flex items-center gap-3">
            {hasUnread ? (
              <NotificationBadge
                count={unreadCount}
                variant="pill"
                ariaLabel={`${unreadCount > 99 ? '99+' : unreadCount} unread notifications`}
              />
            ) : null}
            <button
              type="button"
              disabled={!hasUnread}
              onClick={async () => {
                if (!user.id) return;
                await markAllNotificationsRead(user.id);
                invalidateNotificationQueries(queryClient, user.id);
              }}
              className="text-[13px] font-extrabold text-primary disabled:opacity-40"
            >
              Read all
            </button>
            <Link
              href="/profile/notifications"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 text-primary shadow-sm hover:bg-[#EDE8FF]/60"
              aria-label="Notification settings"
            >
              <IoSettingsOutline size={21} />
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTER_TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-full px-4 py-2 text-[13px] font-extrabold transition ${
              filter === tab ? 'linkup-gradient-primary text-white shadow-sm' : 'border border-border bg-white text-primary'
            }`}
          >
            {FILTER_LABELS[tab]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
          ))}
        </div>
      ) : filterEmpty ? (
        <AppEmptyState
          emoji="🔔"
          title={`No ${FILTER_LABELS[filter].toLowerCase()} notifications`}
          titleAccent={FILTER_LABELS[filter].toLowerCase()}
          description={`Nothing in ${FILTER_LABELS[filter]} right now. Switch tabs or check back when new updates arrive.`}
          action={{ label: 'Show all', onClick: () => setFilter('all') }}
          secondaryAction={{
            label: 'Discover plans',
            href: '/discover',
            variant: 'secondary',
          }}
        />
      ) : sections.length === 0 ? (
        <AppEmptyState
          emoji="🔔"
          title="You're all caught up"
          titleAccent="caught up"
          description="New offers, escrow updates, and plan activity will land here — same inbox as the LinkUp app."
          tips={[
            { icon: IoPricetagOutline, text: 'Turn on offer alerts in Notifications & visibility' },
            {
              icon: IoNotificationsOutline,
              text: 'Unread items show a dot on Profile until you open them',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
          ]}
          action={{ label: 'Discover plans', href: '/discover' }}
          secondaryAction={{
            label: 'Notification settings',
            href: '/profile/notifications',
            variant: 'secondary',
          }}
        />
      ) : (
        <div className="space-y-6">
          {sections.map((sec) => (
            <div key={sec.title}>
              <p className="mb-3 text-[12px] font-extrabold uppercase tracking-wide text-muted">{sec.title}</p>
              <ul className="space-y-2">
                {sec.items.map((n) => (
                  <li key={n.id}>
                    <div
                      className={`linkup-card flex gap-3 p-4 ${!n.is_read ? 'ring-2 ring-primary/20' : ''}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={async () => {
                          await markNotificationRead(n.id);
                          invalidateNotificationQueries(queryClient, user.id);
                          navigateFromNotification(router.push, { ...n.data, type: n.type });
                        }}
                      >
                        <p className="text-[15px] font-extrabold text-foreground">{n.title}</p>
                        <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">{n.body}</p>
                        <p className="mt-2 text-[12px] font-semibold text-muted">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete notification"
                        className="shrink-0 rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"
                        onClick={async () => {
                          await deleteNotification(n.id);
                          invalidateNotificationQueries(queryClient, user.id);
                        }}
                      >
                        <IoTrashOutline size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {isFetching && !isLoading ? (
        <p className="text-center text-[12px] font-semibold text-muted">Refreshing…</p>
      ) : null}
      <button type="button" onClick={() => void refetch()} className="text-[13px] font-extrabold text-primary underline">
        Refresh
      </button>
    </div>
  );
}
