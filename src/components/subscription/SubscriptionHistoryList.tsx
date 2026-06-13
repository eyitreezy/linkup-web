import {
  formatRelativeSubscriptionTime,
  HIDDEN_SUBSCRIPTION_EVENT_TYPES,
  subscriptionEventLabel,
} from '@/lib/subscription/subscriptionEventLabels';
import { subscriptionEventIcon } from '@/lib/notifications/notificationIcon';
import type { DbSubscriptionEvent } from '@/types/database';
import Link from 'next/link';
import { IoChevronBack } from 'react-icons/io5';

type Props = {
  events: DbSubscriptionEvent[];
  backHref?: string;
  title?: string;
  showUserContext?: boolean;
};

export function SubscriptionHistoryList({
  events,
  backHref = '/subscription',
  title = 'Subscription history',
}: Props) {
  const visibleEvents = events.filter((e) => {
    if (HIDDEN_SUBSCRIPTION_EVENT_TYPES.has(e.event_type)) return false;
    return subscriptionEventLabel(e) != null;
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition hover:border-primary/25 hover:text-primary"
          aria-label="Back"
        >
          <IoChevronBack size={20} />
        </Link>
        <h1 className="font-display text-xl font-extrabold text-foreground">{title}</h1>
      </div>

      <div className="linkup-card divide-y divide-border/50 overflow-hidden">
        {visibleEvents.length === 0 ? (
          <p className="py-10 text-center text-[14px] font-semibold text-muted">No events yet</p>
        ) : (
          visibleEvents.map((event) => {
            const Icon = subscriptionEventIcon(event.event_type);
            const label = subscriptionEventLabel(event);
            return (
              <div key={event.id} className="flex items-center gap-3 p-4">
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold text-foreground">{label}</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-muted">
                    {formatRelativeSubscriptionTime(event.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
