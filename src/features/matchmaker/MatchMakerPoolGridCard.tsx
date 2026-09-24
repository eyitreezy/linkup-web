'use client';

import {
  MatchMakerPoolCardActions,
  MatchMakerPoolCardSignals,
  MatchMakerPoolDistancePill,
} from '@/features/matchmaker/MatchMakerPoolCardParts';
import { ageFromBirthDate, type PoolProfileRow } from '@/lib/matchmaker/compatibility';
import { formatPoolDistanceLabel, poolProfilePhotoUri } from '@/lib/matchmaker/poolCardUtils';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  profile: PoolProfileRow;
  signals?: string[];
  preview?: boolean;
  onPass?: () => void;
  onExpressInterest?: () => void;
  expressBusy?: boolean;
};

export function MatchMakerPoolGridCard({
  profile,
  signals = [],
  preview = false,
  onPass,
  onExpressInterest,
  expressBusy = false,
}: Props) {
  const age = ageFromBirthDate(profile.birth_date);
  const photo = poolProfilePhotoUri(profile);
  const distanceLabel = formatPoolDistanceLabel(profile.distance_km);
  const displayName = profile.display_name?.trim() || 'Member';

  return (
    <article
      className="group min-w-0 overflow-hidden rounded-[18px] border bg-white shadow-[0_8px_28px_rgba(155,27,75,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(155,27,75,0.12)] min-[360px]:rounded-[22px]"
      style={{ borderColor: MATCHMAKER_THEME.border }}
    >
      <div className="relative">
        <div
          className="h-36 min-[360px]:h-44 w-full"
          style={{ background: `linear-gradient(135deg, ${MATCHMAKER_THEME.surfaceWarm} 0%, #F5E8DF 100%)` }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] font-semibold text-muted/70">
              No photo
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        {distanceLabel ? (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <MatchMakerPoolDistancePill label={distanceLabel} />
          </div>
        ) : null}
      </div>

      <div className="p-3 min-[360px]:p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-display text-lg font-extrabold leading-snug transition group-hover:opacity-90"
            style={{ color: MATCHMAKER_THEME.textPrimary }}
          >
            {displayName}
            {age != null ? `, ${age}` : ''}
          </h3>
          {profile.verified_badge ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
              style={{ background: `${MATCHMAKER_THEME.accent}18`, color: MATCHMAKER_THEME.accent }}
            >
              <IoShieldCheckmark size={11} />
              Verified
            </span>
          ) : null}
        </div>

        {profile.location_label ? (
          <p className="mt-1 truncate text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            {profile.location_label}
          </p>
        ) : null}

        <MatchMakerPoolCardSignals signals={signals} className="mt-3" />

        <MatchMakerPoolCardActions
          preview={preview}
          onPass={onPass}
          onExpressInterest={onExpressInterest}
          expressBusy={expressBusy}
          className="mt-4"
        />
      </div>
    </article>
  );
}
