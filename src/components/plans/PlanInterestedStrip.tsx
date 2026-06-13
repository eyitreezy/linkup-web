'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TierBadge } from '@/components/subscription/TierBadge';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { usePermission } from '@/hooks/usePermission';
import type { DbProfile } from '@/types/database';
import {
  fetchHiddenEngagementUserIds,
  filterEngagementsByIncognito,
} from '@/lib/plans/incognitoEngagement';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoLockClosed } from 'react-icons/io5';

type EngRow = Pick<
  DbProfile,
  'user_id' | 'display_name' | 'avatar_url' | 'primary_photo_url' | 'photo_urls'
>;

type Props = {
  planId: string;
  hostUserId: string;
  currentUserId?: string;
};

export function PlanInterestedStrip({ planId, hostUserId, currentUserId }: Props) {
  const { allowed, loading: permLoading } = usePermission('plans.see_all_likes', {
    skip: currentUserId !== hostUserId,
  });
  const [rows, setRows] = useState<EngRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [interestCount, setInterestCount] = useState(0);
  const runGated = useGatedAction();

  const load = useCallback(async () => {
    const client = createClient();
    const { data: eng } = await client
      .from('plan_engagements')
      .select('user_id, kind, created_at')
      .eq('plan_id', planId)
      .in('kind', ['view', 'save'])
      .order('created_at', { ascending: false })
      .limit(40);

    const engagements = eng ?? [];
    const userIds = [...new Set(engagements.map((e) => e.user_id as string))];
    const hiddenIds = await fetchHiddenEngagementUserIds(userIds);
    const visible = filterEngagementsByIncognito(engagements, hiddenIds);
    const visibleUserIds = [...new Set(visible.map((e) => e.user_id as string))];
    setInterestCount(visibleUserIds.length);

    if (!allowed) {
      setLoading(false);
      return;
    }

    if (visibleUserIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await client
      .from('profiles')
      .select(
        'user_id, display_name, avatar_url, primary_photo_url, photo_urls, incognito_browse_enabled'
      )
      .in('user_id', visibleUserIds);

    const filteredProfiles = (profiles ?? []).filter(
      (p) => !hiddenIds.has(p.user_id as string)
    );
    setRows(filteredProfiles as EngRow[]);
    setLoading(false);
  }, [allowed, planId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (currentUserId !== hostUserId) return null;

  if (permLoading || loading) {
    return (
      <section className="rounded-2xl border border-border bg-white px-5 py-4">
        <p className="text-[13px] font-semibold text-muted">Loading interested users…</p>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="rounded-2xl border border-border bg-white px-5 py-4">
        <button
          type="button"
          onClick={() => void runGated('plans.see_all_likes', () => {})}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full bg-[#EDE8FF] ring-2 ring-white blur-[1px]"
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-foreground">
              {interestCount} {interestCount === 1 ? 'person is' : 'people are'} interested
            </p>
            <p className="text-[12px] font-semibold text-muted">Upgrade to Gold to see who</p>
          </div>
          <TierBadge tier="GOLD" size="sm" />
          <IoLockClosed className="shrink-0 text-muted" size={16} />
        </button>
      </section>
    );
  }

  const shown = rows.slice(0, 5);
  const overflow = rows.length - shown.length;

  return (
    <section className="rounded-2xl border border-border bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-extrabold text-foreground">Interested</h3>
        <Link
          href={`/plan/${planId}/negotiate`}
          className="text-[12px] font-extrabold text-primary underline"
        >
          Connect with all →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] font-semibold text-muted">No interest yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {shown.map((r) => (
            <Link
              key={r.user_id}
              href={`/user/${r.user_id}`}
              className="rounded-full ring-2 ring-white transition hover:ring-primary/30"
              title={r.display_name ?? 'User'}
            >
              <ProfileAvatar profile={r} displayName={r.display_name} size={40} />
            </Link>
          ))}
          {overflow > 0 ? (
            <span className="rounded-full bg-[#EDE8FF] px-2.5 py-1 text-[12px] font-extrabold text-primary">
              +{overflow} more
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}
