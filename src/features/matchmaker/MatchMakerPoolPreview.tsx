'use client';

import { ListGridViewToggle, type ListGridViewMode } from '@/components/feed/ListGridViewToggle';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPoolGridCard } from '@/features/matchmaker/MatchMakerPoolGridCard';
import { MatchMakerPoolListCard } from '@/features/matchmaker/MatchMakerPoolListCard';
import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';
import { cn } from '@/utils/cn';
import { useCallback, useState } from 'react';

type Props = { profiles: PoolProfileRow[] };

export function MatchMakerPoolPreview({ profiles }: Props) {
  const [view, setView] = useState<ListGridViewMode>('list');

  const setViewPersisted = useCallback((next: ListGridViewMode) => {
    setView(next);
  }, []);

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <TabPageHeader
          kicker="MatchMaker"
          title="Your pool"
          description="One connection at a time. Take your time."
          icon={<MatchMakerTabIcon size={22} />}
        />

        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-muted min-[360px]:text-[11px] sm:text-[12px]">
            {profiles.length} member{profiles.length === 1 ? '' : 's'} in your pool
          </p>
          <ListGridViewToggle view={view} onViewChange={setViewPersisted} />
        </div>

        {view === 'list' ? (
          <ul className="mt-4 flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
            {profiles.map((profile) => (
              <li key={profile.user_id}>
                <MatchMakerPoolListCard profile={profile} preview />
              </li>
            ))}
          </ul>
        ) : (
          <div className={cn('mt-4 grid grid-cols-1 gap-3 min-[400px]:gap-5 sm:grid-cols-2')}>
            {profiles.map((profile) => (
              <MatchMakerPoolGridCard key={profile.user_id} profile={profile} preview />
            ))}
          </div>
        )}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
