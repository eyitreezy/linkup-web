'use client';

import { MoodLiveBorder } from '@/components/discovery/MoodLiveBorder';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { MOOD_REACH_DISPLAY } from '@/lib/plans/moodPlanTierConfig';
import type { PlanFeedRow } from '@/services/plans.service';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { IoGlobeOutline, IoHourglassOutline, IoSparkles } from 'react-icons/io5';

function useMoodWindowLive(expiresAtIso: string | null | undefined): boolean {
  const [live, setLive] = useState(() =>
    expiresAtIso ? new Date(expiresAtIso).getTime() > Date.now() : false
  );
  useEffect(() => {
    if (!expiresAtIso) {
      setLive(false);
      return;
    }
    const tick = () => setLive(new Date(expiresAtIso).getTime() > Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);
  return live;
}

type Props = {
  plan: PlanFeedRow;
  className?: string;
  viewerUserId?: string;
};

export function MoodPlanDiscoverPill({ plan, className, viewerUserId }: Props) {
  const meta = useMemo(() => moodDiscoverMeta(plan), [plan]);
  const name = plan.creator?.display_name?.trim() || 'Host';
  const avatar = plan.creator?.avatar_url;
  const isLive = useMoodWindowLive(plan.mood_expires_at);
  const isOwnPlan = !!(viewerUserId && plan.creator_id === viewerUserId);
  const boosted = isPlanBoostActive(plan.boosted_until);
  const reachLabel =
    isOwnPlan && plan.mood_reach ? MOOD_REACH_DISPLAY[plan.mood_reach] ?? plan.mood_reach : null;
  const [expanded, setExpanded] = useState(false);

  return (
    <MoodLiveBorder active={isLive} className={className}>
      <div
        className="relative bg-gradient-to-br from-white via-[#F7F4FF] to-[#FFF5F8]"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-transparent"
          aria-hidden
        />
        {boosted ? (
          <span className="pointer-events-none absolute right-2 top-2 z-10" aria-hidden>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full linkup-gradient-primary text-[10px] font-extrabold leading-none text-white">
              ⚡
            </span>
          </span>
        ) : null}
        <Link
          href={`/plan/${plan.id}`}
          className={cn(
            'relative block transition active:scale-[0.995]',
            expanded ? 'px-5 py-5' : 'px-4 py-3.5'
          )}
        >
          {!expanded ? (
            <div className="flex items-center gap-3">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border-2 border-primary/30 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-secondary/25 bg-primary/10 font-extrabold text-primary">
                  {name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-extrabold leading-snug text-foreground">
                  {plan.title}
                </p>
                <p className="truncate text-[13px] font-semibold text-muted">{name}</p>
                {reachLabel ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
                    <IoGlobeOutline size={12} />
                    {reachLabel}
                  </p>
                ) : null}
              </div>
              {plan.mood_expires_at ? (
                <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-secondary/20 bg-secondary/5 px-2.5 py-1.5">
                  <IoHourglassOutline
                    size={15}
                    className={cn('text-secondary', isLive && 'mood-gear-spin')}
                  />
                  <MoodPlanCountdown expiresAtIso={plan.mood_expires_at} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider linkup-gradient-primary text-white shadow-sm">
                  <IoSparkles size={14} />
                  Mood moment
                </span>
                {meta.moodTypeLabel ? (
                  <span className="rounded-lg border border-primary/25 bg-white/90 px-2.5 py-1 text-[11px] font-extrabold lowercase text-primary">
                    {meta.moodTypeLabel}
                  </span>
                ) : null}
              </div>
              <h3 className="font-display text-lg font-extrabold leading-snug text-foreground">{plan.title}</h3>
              <div className="flex items-center gap-2">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[12px] font-extrabold text-primary">
                    {name.charAt(0)}
                  </div>
                )}
                <span className="text-[13px] font-bold text-muted">{name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {meta.urgencyLabel ? (
                  <span className="rounded-full border border-secondary/35 bg-secondary/15 px-2.5 py-1 text-[11px] font-extrabold text-secondary">
                    {meta.urgencyLabel}
                  </span>
                ) : null}
                {plan.mood_expires_at ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/20 bg-secondary/8 px-2.5 py-1">
                    <IoHourglassOutline
                      size={14}
                      className={cn('text-secondary', isLive && 'mood-gear-spin')}
                    />
                    <MoodPlanCountdown expiresAtIso={plan.mood_expires_at} />
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </Link>
      </div>
    </MoodLiveBorder>
  );
}
