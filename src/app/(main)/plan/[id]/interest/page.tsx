'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { usePermission } from '@/hooks/usePermission';
import {
  fetchHiddenEngagementUserIds,
  filterEngagementsByIncognito,
} from '@/lib/plans/incognitoEngagement';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoArrowBack,
  IoBookmarkOutline,
  IoEyeOutline,
  IoHeartOutline,
  IoLockClosed,
} from 'react-icons/io5';

type EngagementRow = {
  user_id: string;
  kind: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  primary_photo_url: string | null;
  photo_urls: string[] | null;
};

type PlanMeta = { id: string; title: string | null; creator_id: string };

export default function PlanInterestPage() {
  const { id: planId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const runGated = useGatedAction();
  const { allowed: canSeeInterest, loading: permLoading } = usePermission('plans.see_all_likes');

  const [plan, setPlan] = useState<PlanMeta | null>(null);
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    const client = createClient();

    const { data: planData } = await client
      .from('plans')
      .select('id, title, creator_id')
      .eq('id', planId)
      .single();

    if (!planData) {
      setLoading(false);
      return;
    }
    setPlan(planData as PlanMeta);

    if (planData.creator_id !== user?.id || !canSeeInterest) {
      setLoading(false);
      return;
    }

    const { data: eng } = await client
      .from('plan_engagements')
      .select('user_id, kind, created_at')
      .eq('plan_id', planId)
      .in('kind', ['view', 'save'])
      .order('created_at', { ascending: false });

    const engagements = eng ?? [];
    const userIds = [...new Set(engagements.map((e) => e.user_id as string))];
    const hiddenIds = await fetchHiddenEngagementUserIds(userIds);
    const visible = filterEngagementsByIncognito(engagements, hiddenIds);
    const visibleIds = [...new Set(visible.map((e) => e.user_id as string))];

    if (visibleIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await client
      .from('profiles')
      .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls')
      .in('user_id', visibleIds);

    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const nextRows: EngagementRow[] = visible
      .filter((e) => !hiddenIds.has(e.user_id as string))
      .map((e) => {
        const p = pmap.get(e.user_id as string);
        return {
          user_id: e.user_id as string,
          kind: e.kind as string,
          created_at: e.created_at as string,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          primary_photo_url: p?.primary_photo_url ?? null,
          photo_urls: (p?.photo_urls as string[] | null) ?? null,
        };
      });

    setRows(nextRows);
    setLoading(false);
  }, [planId, user?.id, canSeeInterest]);

  useEffect(() => {
    void load();
  }, [load]);

  const { viewCount, saveCount } = useMemo(() => {
    let views = 0;
    let saves = 0;
    for (const r of rows) {
      if (r.kind === 'save') saves++;
      else views++;
    }
    return { viewCount: views, saveCount: saves };
  }, [rows]);

  if (!loading && plan && plan.creator_id !== user?.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-sm rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
          <IoLockClosed size={32} className="mx-auto text-muted/40" />
          <p className="mt-4 text-[15px] font-extrabold text-foreground">Host only</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Only the host can see who viewed or saved this plan.
          </p>
        </div>
      </div>
    );
  }

  if (!permLoading && !canSeeInterest) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] font-extrabold text-primary"
        >
          <IoArrowBack size={16} /> Back
        </button>
        <div className="rounded-3xl border border-primary/15 bg-[#EDE8FF]/30 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl linkup-gradient-primary">
            <IoHeartOutline size={28} className="text-white" />
          </div>
          <p className="mt-4 font-display text-[20px] font-extrabold text-foreground">
            See who is into your plans
          </p>
          <p className="mt-2 text-[14px] font-semibold text-muted">
            Gold shows everyone who viewed or saved this meetup so you know who to welcome first.
          </p>
          <button
            type="button"
            onClick={() => void runGated('plans.see_all_likes', () => {})}
            className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white shadow-md"
          >
            Upgrade to Gold
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Premium insight"
        title="Who is interested"
        subtitle={plan?.title ?? undefined}
        backHref={`/plan/${planId}`}
        backLabel="Back to meetup details"
      />

      {plan?.title ? (
        <p className="text-[14px] font-semibold text-muted">
          Views and saves on this meetup. Tap a profile to open it.
        </p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-[#EDE8FF]/30 px-4 py-2">
            <IoEyeOutline size={15} className="text-primary" />
            <span className="text-[13px] font-extrabold text-foreground">{viewCount} viewed</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-secondary/15 bg-[#FFF0F4]/40 px-4 py-2">
            <IoBookmarkOutline size={15} className="text-secondary" />
            <span className="text-[13px] font-extrabold text-foreground">{saveCount} saved</span>
          </div>
        </div>
      ) : null}

      {(loading || permLoading) && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
            >
              <div className="h-12 w-12 animate-pulse rounded-full bg-[#EDE8FF]/60" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/5 animate-pulse rounded-lg bg-[#EDE8FF]/60" />
                <div className="h-3 w-1/3 animate-pulse rounded-lg bg-[#EDE8FF]/40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !permLoading && rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-10 text-center">
          <IoHeartOutline size={40} className="mx-auto text-muted/30" />
          <p className="mt-4 text-[16px] font-extrabold text-foreground">No interest yet</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            When people view or save this plan, they will show up here.
          </p>
        </div>
      ) : null}

      {!loading && !permLoading && rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <Link
              key={`${row.user_id}-${row.kind}-${i}`}
              href={`/user/${row.user_id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 transition hover:border-primary/25 hover:shadow-sm"
            >
              <ProfileAvatar
                profile={{
                  avatar_url: row.avatar_url,
                  primary_photo_url: row.primary_photo_url,
                  photo_urls: row.photo_urls,
                }}
                displayName={row.display_name}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold text-foreground">
                  {row.display_name?.trim() || 'Member'}
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-muted">
                  {row.kind === 'save' ? 'Saved this plan' : 'Viewed this plan'}
                  {' · '}
                  {new Date(row.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <span
                className={[
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                  row.kind === 'save'
                    ? 'bg-[#FFF0F4]/60 text-secondary'
                    : 'bg-[#EDE8FF]/60 text-primary',
                ].join(' ')}
              >
                {row.kind === 'save' ? 'Saved' : 'Viewed'}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
