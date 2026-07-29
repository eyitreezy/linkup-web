import {
  formatRelativeSubscriptionTime,
  HIDDEN_SUBSCRIPTION_EVENT_TYPES,
  subscriptionEventLabel,
} from '@/lib/subscription/subscriptionEventLabels';
import { subscriptionEventIcon } from '@/lib/notifications/notificationIcon';
import type { DbSubscriptionEvent } from '@/types/database';

type Props = {
  events: DbSubscriptionEvent[];
  emptyMessage?: string;
};

export function SubscriptionHistoryContent({
  events,
  emptyMessage = 'No events yet',
}: Props) {
  const visibleEvents = events.filter((e) => {
    if (HIDDEN_SUBSCRIPTION_EVENT_TYPES.has(e.event_type)) return false;
    return subscriptionEventLabel(e) != null;
  });

  return (
    <div className="linkup-card divide-y divide-border/50 overflow-hidden">
      {visibleEvents.length === 0 ? (
        <p className="py-10 text-center text-[14px] font-semibold text-muted">{emptyMessage}</p>
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
  );
}
