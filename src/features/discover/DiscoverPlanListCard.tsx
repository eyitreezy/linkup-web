'use client';

import { HostRatingBadge } from '@/components/reviews/HostRatingBadge';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { HostPresenceChip } from '@/components/presence/HostPresenceChip';
import { CreatorSpotlightChip } from '@/components/plans/CreatorSpotlightChip';
import { BoostPill } from '@/components/plans/BoostPill';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import { TierBadge } from '@/components/subscription/TierBadge';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import { derivePresenceUi, type PresenceUi } from '@/lib/presence/hostPresenceStatus';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { planHeroUri } from '@/lib/plans/planHero';
import { publicProfileHref } from '@/lib/profile/profileRoutes';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbProfile } from '@/types/database';
import Link from 'next/link';
import { useMemo } from 'react';
import { IoChevronForward, IoNavigateOutline, IoShieldCheckmark } from 'react-icons/io5';

function formatPlanPriceGross(row: PlanFeedRow): string | null {
  if (row.starting_price_cents != null && row.starting_price_cents > 0) {
    return formatNGN(grossAmountCents(row.starting_price_cents));
  }
  return null;
}

function formatWhen(row: PlanFeedRow): string {
  if (row.is_mood_plan) return 'Mood moment';
  if (!row.scheduled_at) return 'Flexible timing';
  return new Date(row.scheduled_at).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type Props = {
  plan: PlanFeedRow;
  distanceLabel: string;
  presence: PresenceUi | null;
  viewerProfile: DbProfile | null;
  viewerUserId?: string;
};

export function DiscoverPlanListCard({
  plan,
  distanceLabel,
  presence,
  viewerProfile,
  viewerUserId,
}: Props) {
  const hero = planHeroUri(plan);
  const name = plan.creator?.display_name?.trim() || 'Host';
  const verified = !!plan.creator?.verified_badge;
  const boosted = isPlanBoostActive(plan.boosted_until);
  const isPlatinum = plan.creator?.subscription_tier === 'PLATINUM';
  const isCreatorSpotlighted =
    !boosted && !isPlatinum && isCreatorSpotlightActive(plan.creator?.spotlight_until);
  const isOwn = viewerUserId != null && plan.creator_id === viewerUserId;
  const hostProfileHref = publicProfileHref(plan.creator_id, viewerUserId);
  const showPresence = !isOwn;
  const presenceUi = useMemo(
    () =>
      showPresence
        ? presence ??
          derivePresenceUi(
            viewerProfile,
            plan.creator?.preferences,
            null,
            !!plan.creator?.masked_activity_enabled
          )
        : null,
    [showPresence, presence, viewerProfile, plan.creator?.preferences, plan.creator?.masked_activity_enabled]
  );
  const moodMeta = useMemo(() => moodDiscoverMeta(plan), [plan]);
  const trustScore = plan.creator?.ai_trust_score;
  const showTrust = typeof trustScore === 'number' && trustScore >= 0.72;

  const priceGrossLabel = formatPlanPriceGross(plan);
  const suggestedShareCents =
    isGroupSplitPlan(plan) && plan.current_suggested_share_cents
      ? plan.current_suggested_share_cents
      : null;
  const suggestedShareGrossLabel =
    suggestedShareCents != null ? formatNGN(grossAmountCents(suggestedShareCents)) : null;

  return (
    <article className="group flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-[0_6px_20px_rgba(42,31,85,0.07)] transition hover:border-primary/25 hover:shadow-[0_10px_28px_rgba(108,99,255,0.12)] sm:flex-row sm:items-stretch">
      <Link
        href={`/plan/${plan.id}`}
        className="relative aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:w-[38%] sm:max-w-[220px] sm:min-h-[128px] md:w-[40%] md:max-w-[240px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#EDE8FF] to-[#FFF0F5]" />
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            className="relative h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:absolute sm:inset-0"
            loading="lazy"
          />
        ) : (
          <div className="relative flex aspect-[16/10] items-center justify-center text-[11px] font-semibold text-muted/60 sm:absolute sm:inset-0 sm:aspect-auto sm:min-h-[128px]">
            No photo
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent sm:bg-gradient-to-r sm:from-black/35 sm:via-black/10 sm:to-transparent" />
        <span className="absolute left-2.5 top-2.5 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white linkup-gradient-primary shadow-sm">
          <IoNavigateOutline size={11} className="shrink-0" />
          <span className="truncate">{distanceLabel}</span>
        </span>
        {boosted ? (
          <span className="absolute bottom-2.5 left-2.5">
            <BoostPill variant="mini" />
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3.5 sm:gap-2.5 sm:px-4 sm:py-3.5">
        <Link href={`/plan/${plan.id}`} className="block">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug text-foreground group-hover:text-primary sm:text-base">
                {plan.title}
              </h3>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-muted">
                {plan.location_label ?? 'Location TBD'}
              </p>
            </div>
            {verified ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700">
                <IoShieldCheckmark size={10} />
              </span>
            ) : null}
          </div>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={hostProfileHref}
            className="shrink-0 rounded-full ring-offset-2 transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`View ${name}'s profile`}
          >
            <AvatarWithPresence
              uri={plan.creator?.avatar_url}
              name={name}
              size={34}
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
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <HostPresenceChip presence={presenceUi} className="!py-0.5 !text-[10px]" />
              {showTrust ? (
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800">
                  Trusted
                </span>
              ) : null}
              {boosted ? (
                <span className="hidden sm:inline-flex">
                  <BoostPill />
                </span>
              ) : null}
            </div>
          </Link>
        </div>

        <Link href={`/plan/${plan.id}`} className="block">
          {moodMeta.showMood ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-secondary/15 bg-secondary/5 px-2 py-1">
              {moodMeta.urgencyLabel ? (
                <span className="text-[10px] font-extrabold text-secondary">{moodMeta.urgencyLabel}</span>
              ) : null}
              {moodMeta.moodTypeLabel ? (
                <span className="text-[10px] font-extrabold lowercase text-primary">{moodMeta.moodTypeLabel}</span>
              ) : null}
              {moodMeta.moodExpiresAt ? <MoodPlanCountdown expiresAtIso={moodMeta.moodExpiresAt} /> : null}
            </div>
          ) : (
            <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-muted sm:line-clamp-1">
              {plan.description?.trim() || 'Tap for full details'}
            </p>
          )}

          <div className="mt-2 flex flex-col items-end gap-0.5 border-t border-border/50 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex w-full flex-col items-start sm:w-auto">
              {suggestedShareGrossLabel ? (
                <span className="shrink-0 text-[13px] font-extrabold text-primary">
                  {suggestedShareGrossLabel}
                  <span className="font-semibold text-muted"> / person</span>
                </span>
              ) : priceGrossLabel ? (
                <span className="shrink-0 text-[13px] font-extrabold text-primary">{priceGrossLabel}</span>
              ) : (
                <span className="shrink-0 text-[13px] font-extrabold text-primary">Free to join</span>
              )}
            </div>
            <span className="min-w-0 truncate text-right text-[11px] font-semibold text-muted">{formatWhen(plan)}</span>
          </div>
        </Link>
      </div>

      <Link
        href={`/plan/${plan.id}`}
        className="hidden w-9 shrink-0 items-center justify-center border-l border-border/40 bg-[#FAFAFF]/80 text-muted group-hover:text-primary sm:flex"
        aria-hidden
      >
        <IoChevronForward size={18} className="opacity-50 group-hover:opacity-100" />
      </Link>
    </article>
  );
}
