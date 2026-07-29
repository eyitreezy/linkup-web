import { SubscriptionHistoryContent } from '@/components/subscription/SubscriptionHistoryContent';
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

      <SubscriptionHistoryContent events={events} />
    </div>
  );
}
