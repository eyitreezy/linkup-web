'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { HostPresenceChip } from '@/components/presence/HostPresenceChip';
import { BoostPill } from '@/components/plans/BoostPill';
import { PlanCardHero } from '@/components/plans/PlanCardHero';
import { derivePresenceUi, type PresenceUi } from '@/lib/presence/hostPresenceStatus';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import type { PlanFeedRow } from '@/services/plans.service';
import type { DbProfile } from '@/types/database';
import Link from 'next/link';
import { IoShieldCheckmark } from 'react-icons/io5';

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
  const price =
    plan.starting_price_cents != null && plan.starting_price_cents > 0
      ? `₦${(plan.starting_price_cents / 100).toLocaleString()}`
      : 'Free';
  const name = plan.creator?.display_name ?? 'Host';
  const verified = !!plan.creator?.verified_badge;
  const boosted = isPlanBoostActive(plan.boosted_until);
  const isOwn = viewerUserId != null && plan.creator_id === viewerUserId;
  const showPresence = !isOwn;
  const presenceUi = showPresence
    ? (presence ?? derivePresenceUi(viewerProfile, plan.creator?.preferences, null))
    : null;

  return (
    <Link
      href={`/plan/${plan.id}`}
      className="group block min-w-0 overflow-hidden rounded-[18px] border border-primary/10 bg-white shadow-[0_8px_28px_rgba(42,31,85,0.08)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_36px_rgba(108,99,255,0.14)] min-[360px]:rounded-[22px]"
    >
      <div className="relative">
        <PlanCardHero plan={plan} className="h-36 min-[360px]:h-44" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {distanceLabel ? (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-extrabold text-white backdrop-blur-sm">
              {distanceLabel}
            </span>
          ) : null}
          {boosted ? <BoostPill variant="mini" /> : null}
        </div>
      </div>
      <div className="p-3 min-[360px]:p-4">
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
        <div className="mt-3 flex items-center gap-2.5">
          <AvatarWithPresence
            uri={plan.creator?.avatar_url}
            name={name}
            size={40}
            presence={presenceUi}
            showDot={showPresence && !!presenceUi?.dot}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-extrabold text-foreground">{name}</p>
            <p className="truncate text-[12px] font-semibold text-muted">
              {plan.location_label ?? 'Location TBD'}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <HostPresenceChip presence={presenceUi} />
          {boosted ? <BoostPill /> : null}
        </div>
        <p className="mt-3 text-[14px] font-extrabold text-primary">{price}</p>
      </div>
    </Link>
  );
}
