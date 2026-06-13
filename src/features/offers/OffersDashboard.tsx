'use client';

import { EngagementCarousel } from '@/components/plans/EngagementCarousel';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { OfferListCard } from '@/features/offers/OfferListCard';
import { fetchFeedEngagementCarousel } from '@/lib/plans/fetchFeedEngagementCarousel';
import { createClient } from '@/lib/supabase/client';
import { isOfferExpired } from '@/lib/plans/offerRules';
import {
  acceptPlanOffer,
  fetchReceivedOffers,
  fetchSentOffers,
  type OfferDashboardRow,
} from '@/services/offers.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoMailUnreadOutline, IoPaperPlaneOutline, IoPricetag } from 'react-icons/io5';

type Segment = 'sent' | 'received';

export function OffersDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<Segment>('sent');
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['offers-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return { sent: [] as OfferDashboardRow[], received: [] as OfferDashboardRow[] };
      const client = createClient();
      const [sent, received] = await Promise.all([
        fetchSentOffers(client, user.id),
        fetchReceivedOffers(client, user.id),
      ]);
      return { sent, received };
    },
    enabled: !!user?.id,
  });

  const { data: engagementItems = [], isLoading: engagementLoading } = useQuery({
    queryKey: ['offers-engagement-carousel', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const client = createClient();
      return fetchFeedEngagementCarousel(client, user.id);
    },
    enabled: !!user?.id,
  });

  const sent = data?.sent ?? [];
  const received = data?.received ?? [];
  const list = segment === 'sent' ? sent : received;
  const total = sent.length + received.length;

  async function handleAccept(row: OfferDashboardRow) {
    if (!user?.id) return;
    if (isOfferExpired(row.offer)) {
      window.alert('This offer is no longer active.');
      return;
    }
    setBusyOfferId(row.offer.id);
    const client = createClient();
    const res = await acceptPlanOffer(client, {
      planId: row.plan.id,
      offer: row.offer,
      plan: row.plan,
      currentUserId: user.id,
    });
    setBusyOfferId(null);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['offers-dashboard'] });
    router.push(`/plan/${row.plan.id}`);
  }

  async function handleReject(row: OfferDashboardRow) {
    if (!window.confirm('Decline this offer? The guest will see it as declined.')) return;
    setBusyOfferId(row.offer.id);
    const client = createClient();
    const { error: err } = await client
      .from('plan_offers')
      .update({ status: 'declined' })
      .eq('id', row.offer.id);
    setBusyOfferId(null);
    if (err) window.alert(err.message);
    else void queryClient.invalidateQueries({ queryKey: ['offers-dashboard'] });
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view offers.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-6 pb-10">
      <div className="space-y-3">
        <TabPageHeader
          kicker="Negotiations"
          title="Offers"
          description="Proposals you&apos;ve sent and offers on your plans — synced with the mobile app."
          icon={<IoPricetag size={22} />}
        />
        {total > 0 ? (
          <div className="flex min-h-7 items-center">
            <span className="rounded-full bg-[#EDE8FF] px-3 py-1 text-[11px] font-extrabold tabular-nums text-primary min-[360px]:text-[12px]">
              {total} total
            </span>
          </div>
        ) : null}
      </div>

      <EngagementCarousel items={engagementItems} loading={engagementLoading} />

      <div className="h-px bg-border/80" aria-hidden />

      <div className="flex rounded-2xl border border-border bg-surface p-1">
        {(['sent', 'received'] as const).map((seg) => (
          <button
            key={seg}
            type="button"
            onClick={() => setSegment(seg)}
            className={cn(
              'min-w-0 flex-1 rounded-xl px-2 py-2.5 text-[12px] font-extrabold transition min-[360px]:px-4 min-[360px]:text-[13px]',
              segment === seg ? 'linkup-gradient-primary text-white shadow-sm' : 'text-muted hover:text-foreground'
            )}
          >
            <span className="block truncate">
              {seg === 'sent' ? `Sent (${sent.length})` : `Received (${received.length})`}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-[14px] font-semibold text-[#EF4444]">
          {error instanceof Error ? error.message : 'Could not load offers'}
          <button
            type="button"
            className="ml-2 font-extrabold text-primary underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {isLoading || isFetching ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <AppEmptyState
          icon={
            segment === 'sent' ? (
              <IoPaperPlaneOutline size={40} className="text-secondary" />
            ) : (
              <IoMailUnreadOutline size={40} className="text-primary" />
            )
          }
          title={segment === 'sent' ? 'No offers sent yet' : 'Inbox is quiet'}
          titleAccent={segment === 'received' ? 'quiet' : undefined}
          description={
            segment === 'sent'
              ? 'When you negotiate on a plan, every round you send appears here with status and timing.'
              : 'When someone wants in on your plan, their offer lands here — accept to move to agreement.'
          }
          action={{ label: 'Browse Discover', href: '/discover' }}
          secondaryAction={
            segment === 'received'
              ? { label: 'Manage plans', href: '/plan-management', variant: 'secondary' }
              : undefined
          }
        />
      ) : (
        <ul className="space-y-4">
          {list.map((row) => (
            <li key={row.offer.id}>
              <OfferListCard
                row={row}
                mode={segment}
                busy={busyOfferId === row.offer.id}
                onAccept={segment === 'received' ? () => void handleAccept(row) : undefined}
                onReject={segment === 'received' ? () => void handleReject(row) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
