'use client';

import { MeetTypeExploreCard, MeetTypeExploreCardSkeleton, meetrGridClass } from '@/components/meetr/MeetTypeExploreCard';
import { MeetTypeReviewPendingModal } from '@/components/plans/MeetTypeReviewPendingModal';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { setPendingMeetTypeFilter } from '@/lib/discovery/pendingMeetTypeFilter';
import { useMeetTypesRealtime } from '@/hooks/useMeetTypesRealtime';
import { isCatalogMeetType, isPendingMeetType } from '@/lib/plans/meetTypes';
import { createClient } from '@/lib/supabase/client';
import { fetchMeetTypesForUser } from '@/services/meetTypes.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbMeetType } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IoAddCircleOutline, IoCompass } from 'react-icons/io5';

export function MeetrScreen() {
  const user = useAuthStore((s) => s.user);
  useMeetTypesRealtime(user?.id);
  const router = useRouter();
  const [pendingTileType, setPendingTileType] = useState<DbMeetType | null>(null);
  const [pendingTileModalOpen, setPendingTileModalOpen] = useState(false);

  const { data: types = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['meetr-meet-types', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { rows, error } = await fetchMeetTypesForUser(createClient(), user.id);
      if (error) throw new Error(error);
      return rows;
    },
    enabled: !!user?.id,
  });

  const catalogTypes = useMemo(() => types.filter(isCatalogMeetType), [types]);
  const customTypes = useMemo(() => types.filter((t) => !isCatalogMeetType(t)), [types]);

  function onBrowseType(type: DbMeetType) {
    if (isPendingMeetType(type, user?.id)) {
      setPendingTileType(type);
      setPendingTileModalOpen(true);
      return;
    }
    setPendingMeetTypeFilter({ id: type.id, name: type.name });
    router.push('/discover');
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to explore meet types.
      </p>
    );
  }

  function renderGrid(items: DbMeetType[], userId: string) {
    return (
      <div className={meetrGridClass}>
        {items.map((type) => (
          <MeetTypeExploreCard key={type.id} type={type} userId={userId} onPress={onBrowseType} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 pb-16">
      <TabPageHeader
        kicker="Explore"
        title="Meetr"
        description="Choose a meet type to explore matching plans on Discover, from dinner and gym to mood and hangouts."
        icon={<IoCompass size={22} />}
      />

      {isLoading ? (
        <div className={meetrGridClass}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <MeetTypeExploreCardSkeleton key={i} />
          ))}
        </div>
      ) : types.length === 0 ? (
        <AppEmptyState
          icon={<IoCompass size={36} className="text-primary" />}
          title="No meet types yet"
          description="Check back soon, or create a custom type when you post a plan."
          action={{ label: 'Create a plan', href: '/plan/create' }}
        />
      ) : (
        <>
          {catalogTypes.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Browse by vibe</h2>
              {renderGrid(catalogTypes, user.id)}
            </section>
          ) : null}

          {customTypes.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Your meet types</h2>
              {renderGrid(customTypes, user.id)}
            </section>
          ) : null}
        </>
      )}

      <Link
        href="/plan/create"
        className="linkup-card flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white/90 px-4 py-3.5 text-[15px] font-extrabold text-primary transition hover:border-primary/35 hover:bg-[#EDE8FF]/40"
      >
        <IoAddCircleOutline size={20} />
        Create a plan with a custom meet type
      </Link>

      {isFetching && !isLoading ? (
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-[13px] font-extrabold text-primary underline"
        >
          Refresh
        </button>
      ) : null}

      <MeetTypeReviewPendingModal
        open={pendingTileModalOpen}
        onOpenChange={setPendingTileModalOpen}
        meetTypeName={pendingTileType?.name ?? ''}
        mode="pending"
      />
    </div>
  );
}
