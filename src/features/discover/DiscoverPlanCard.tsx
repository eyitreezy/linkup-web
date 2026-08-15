'use client';

import { HostRatingBadge } from '@/components/reviews/HostRatingBadge';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { HostPresenceChip } from '@/components/presence/HostPresenceChip';
import { CreatorSpotlightChip } from '@/components/plans/CreatorSpotlightChip';
import { DiscoverPlanTypePillBadge } from '@/components/plans/discover/DiscoverPlanTypePillBadge';
import { BoostPill } from '@/components/plans/BoostPill';
import { PlanCardHero } from '@/components/plans/PlanCardHero';
import { TierBadge } from '@/components/subscription/TierBadge';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import { derivePresenceUi, type PresenceUi } from '@/lib/presence/hostPresenceStatus';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { MOOD_REACH_DISPLAY } from '@/lib/plans/moodPlanTierConfig';
import { publicProfileHref } from '@/lib/profile/profileRoutes';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbProfile } from '@/types/database';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { IoGlobeOutline, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  plan: PlanFeedRow;
  presence: PresenceUi | null;
  viewerProfile: DbProfile | null;
  viewerUserId?: string;
  distanceLabel?: string;
};

export function DiscoverPlanCard({
  plan,
  presence,
  viewerProfile,
  viewerUserId,
  distanceLabel,
}: Props) {
  const isPaid = plan.starting_price_cents != null && plan.starting_price_cents > 0;
  const priceGrossLabel = isPaid ? formatNGN(grossAmountCents(plan.starting_price_cents!)) : 'Free';
  const name = plan.creator?.display_name ?? 'Host';
  const verified = !!plan.creator?.verified_badge;
  const boosted = isPlanBoostActive(plan.boosted_until);
  const isPlatinum = plan.creator?.subscription_tier === 'PLATINUM';
  const isCreatorSpotlighted =
    !boosted && !isPlatinum && isCreatorSpotlightActive(plan.creator?.spotlight_until);
  const isOwn = viewerUserId != null && plan.creator_id === viewerUserId;
  const hostProfileHref = publicProfileHref(plan.creator_id, viewerUserId);
  const showPresence = !isOwn;
  const presenceUi = showPresence
    ? (presence ??
        derivePresenceUi(
          viewerProfile,
          plan.creator?.preferences,
          null,
          !!plan.creator?.masked_activity_enabled
        ))
    : null;

  const showPlanTypePill = plan.is_group_plan || plan.is_mood_plan;

  return (
    <article className="group min-w-0 overflow-hidden rounded-[18px] border border-primary/10 bg-white shadow-[0_8px_28px_rgba(42,31,85,0.08)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_36px_rgba(108,99,255,0.14)] min-[360px]:rounded-[22px]">
      <Link href={`/plan/${plan.id}`} className="block">
        <div className="relative">
          <PlanCardHero plan={plan} className="h-36 min-[360px]:h-44" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {distanceLabel ? (
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-extrabold text-white backdrop-blur-sm">
                {distanceLabel}
              </span>
            ) : null}
            {showPlanTypePill ? <DiscoverPlanTypePillBadge plan={plan} /> : null}
            {boosted ? <BoostPill variant="mini" /> : null}
          </div>
        </div>
      </Link>
      <div className="p-3 min-[360px]:p-4">
        <Link href={`/plan/${plan.id}`} className="block">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-extrabold leading-snug text-foreground group-hover:text-primary">
              {plan.title}
            </h3>
            {verified ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                <IoShieldCheckmark size={11} />
                Verified
              </span>
            ) : null}
          </div>
          {plan.is_mood_plan && plan.mood_reach ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
              <IoGlobeOutline size={12} />
              {MOOD_REACH_DISPLAY[plan.mood_reach] ?? plan.mood_reach}
            </p>
          ) : null}
        </Link>
        <div className="mt-3 flex items-center gap-2.5">
          <Link
            href={hostProfileHref}
            className="relative shrink-0 overflow-hidden rounded-[1000px] ring-offset-2 transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`View ${name}'s profile`}
          >
            <AvatarWithPresence
              uri={plan.creator?.avatar_url}
              name={name}
              size={40}
              presence={presenceUi}
              showDot={showPresence && !!presenceUi?.dot}
            />
          </Link>
          <Link href={`/plan/${plan.id}`} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-[13px] font-extrabold text-foreground">{name}</p>
              {isPlatinum ? <TierBadge tier="PLATINUM" size="sm" /> : null}
              {isCreatorSpotlighted ? <CreatorSpotlightChip /> : null}
              <HostRatingBadge
                score={plan.creator?.host_rating_score}
                count={plan.creator?.host_rating_count}
                completedMeetupCount={plan.creator?.completed_meetup_count}
              />
            </div>
            <p className="truncate text-[12px] font-semibold text-muted">
              {plan.location_label ?? 'Location TBD'}
            </p>
          </Link>
        </div>
        <Link href={`/plan/${plan.id}`} className="block">
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <HostPresenceChip presence={presenceUi} />
            {boosted ? <BoostPill /> : null}
          </div>
          <p className="mt-3 text-[14px] font-extrabold text-primary">{priceGrossLabel}</p>
        </Link>
      </div>
    </article>
  );
}
