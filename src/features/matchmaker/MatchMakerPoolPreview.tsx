'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MatchMakerPoolCard } from '@/features/matchmaker/MatchMakerPoolCard';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';

type Props = { profiles: PoolProfileRow[] };

export function MatchMakerPoolPreview({ profiles }: Props) {
  return (
    <MatchMakerLayout>
      <div className={`${matchmakerContentClass()} pb-10 pt-2`}>
        <TabPageHeader
          kicker="MatchMaker"
          title="Your pool"
          description="One connection at a time. Take your time."
          icon={<MatchMakerTabIcon size={22} />}
        />
        <div className="mt-6 space-y-3">
          {profiles.map((p) => (
            <MatchMakerPoolCard key={p.user_id} profile={p} preview />
          ))}
        </div>
      </div>
    </MatchMakerLayout>
  );
}
