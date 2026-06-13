'use client';

import { HostPresenceChip } from '@/components/presence/HostPresenceChip';
import { CreatorSpotlightChip } from '@/components/plans/CreatorSpotlightChip';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import { TierBadge } from '@/components/subscription/TierBadge';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import { planIntentTag } from '@/lib/discovery/planIntentTag';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { planHeroUri } from '@/lib/plans/planHero';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';
import type { PlanFeedRow } from '@/services/plans.service';
import { cn } from '@/utils/cn';
import { useMemo } from 'react';
import { IoFlash, IoHourglassOutline, IoPersonOutline, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  plan: PlanFeedRow;
  distanceLabel: string;
  presence: PresenceUi | null;
  className?: string;
};

export function DiscoverSwipeCard({ plan, distanceLabel, presence, className }: Props) {
  const hero = planHeroUri(plan);
  const name = plan.creator?.display_name?.trim() || 'Member';
  const verified = !!plan.creator?.verified_badge;
  const intent = useMemo(() => planIntentTag(plan), [plan]);
  const when = formatPlanWhen(plan);
  const caption = plan.description?.trim() || plan.title;
  const moodMeta = useMemo(() => moodDiscoverMeta(plan), [plan]);
  const boosted = isPlanBoostActive(plan.boosted_until);
  const isPlatinum = plan.creator?.subscription_tier === 'PLATINUM';
  const isCreatorSpotlighted =
    !boosted && !isPlatinum && isCreatorSpotlightActive(plan.creator?.spotlight_until);
  const meetLabel = plan.meet_types?.name?.trim() ?? null;

  return (
    <div
      role="presentation"
      className={cn(
        'relative h-full w-full overflow-hidden rounded-[28px] bg-[#1a1a22] text-left shadow-[0_14px_44px_rgba(15,23,42,0.22)]',
        className
      )}
    >
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2d2d3a]">
          <IoPersonOutline size={48} className="text-white/40" />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/82 via-black/45 to-transparent"
        aria-hidden
      />
      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="min-w-0 max-w-[78%] space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/55 px-3.5 py-2 text-[13px] font-extrabold text-white linkup-gradient-primary shadow-md">
            <span>{intent.emoji}</span>
            {intent.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {boosted ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-gradient-to-r from-secondary to-[#ff8ba0] px-2.5 py-1 text-[11px] font-extrabold text-white">
                <IoFlash size={12} />
                Boosted
              </span>
            ) : null}
            {meetLabel ? (
              <span className="rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[11px] font-extrabold text-white">
                {meetLabel}
              </span>
            ) : null}
            {moodMeta.showMood && moodMeta.urgencyLabel ? (
              <span className="rounded-full border border-amber-200/85 bg-amber-400/35 px-2.5 py-1 text-[11px] font-extrabold text-white">
                {moodMeta.urgencyLabel}
              </span>
            ) : null}
            {moodMeta.showMood && moodMeta.moodExpiresAt ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200/85 bg-orange-500/55 px-2.5 py-1 text-[11px] font-extrabold text-white">
                <IoHourglassOutline size={12} />
                <MoodPlanCountdown expiresAtIso={moodMeta.moodExpiresAt} tone="onDark" />
              </span>
            ) : null}
            {!plan.is_paid ? (
              <span className="rounded-full border border-emerald-200/50 bg-emerald-500/45 px-2.5 py-1 text-[11px] font-extrabold text-white">
                Free to join
              </span>
            ) : null}
          </div>
        </div>
        {verified ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-emerald-600 shadow-md">
            <IoShieldCheckmark size={20} />
          </span>
        ) : null}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <p className="truncate font-display text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
              {name}
            </p>
            {isPlatinum ? <TierBadge tier="PLATINUM" size="sm" /> : null}
            {isCreatorSpotlighted ? <CreatorSpotlightChip variant="onDark" /> : null}
          </div>
          <HostPresenceChip presence={presence} variant="onDark" />
        </div>
        <p className="mt-1.5 truncate text-[14px] font-semibold text-white/85">
          {distanceLabel}
          {when ? ` · ${when}` : ''}
        </p>
        <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-white/95">{caption}</p>
      </div>
    </div>
  );
}
