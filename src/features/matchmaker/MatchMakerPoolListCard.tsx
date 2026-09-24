'use client';

import {
  MatchMakerPoolCardActions,
  MatchMakerPoolCardSignals,
  MatchMakerPoolDistancePill,
} from '@/features/matchmaker/MatchMakerPoolCardParts';
import { ageFromBirthDate, type PoolProfileRow } from '@/lib/matchmaker/compatibility';
import { formatPoolDistanceLabel, poolProfilePhotoUri } from '@/lib/matchmaker/poolCardUtils';
import { matchmakerProfileHref } from '@/lib/matchmaker/routes';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import Link from 'next/link';
import { IoChevronForward, IoNavigateOutline, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  profile: PoolProfileRow;
  signals?: string[];
  preview?: boolean;
  onPass?: () => void;
  onExpressInterest?: () => void;
  expressBusy?: boolean;
};

export function MatchMakerPoolListCard({
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
  const profileHref = preview ? null : matchmakerProfileHref(profile.user_id);

  const imageBlock = (
    <div
      className="relative aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:w-[38%] sm:max-w-[220px] sm:min-h-[128px] md:w-[40%] md:max-w-[240px]"
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${MATCHMAKER_THEME.surfaceWarm} 0%, #F5E8DF 100%)` }}
      />
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="relative h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:absolute sm:inset-0"
          loading="lazy"
        />
      ) : (
        <div className="relative flex aspect-[16/10] items-center justify-center text-[11px] font-semibold text-muted/70 sm:absolute sm:inset-0 sm:aspect-auto sm:min-h-[128px]">
          No photo
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent sm:bg-gradient-to-r sm:from-black/35 sm:via-black/10 sm:to-transparent" />
      {distanceLabel ? (
        <span className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1">
          <MatchMakerPoolDistancePill
            label={distanceLabel}
            icon={<IoNavigateOutline size={11} className="shrink-0" />}
          />
        </span>
      ) : null}
    </div>
  );

  const summaryBlock = (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug sm:text-base"
            style={{ color: MATCHMAKER_THEME.textPrimary }}
          >
            {displayName}
            {age != null ? `, ${age}` : ''}
          </h3>
          {profile.location_label ? (
            <p className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
              {profile.location_label}
            </p>
          ) : null}
        </div>
        {profile.verified_badge ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold"
            style={{ background: `${MATCHMAKER_THEME.accent}18`, color: MATCHMAKER_THEME.accent }}
          >
            <IoShieldCheckmark size={10} />
          </span>
        ) : null}
      </div>
      <MatchMakerPoolCardSignals signals={signals} compact />
      {profileHref ? (
        <p className="text-right text-[12px] font-extrabold text-primary sm:text-[13px]">View full profile</p>
      ) : null}
    </>
  );

  return (
    <article
      className="group flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_6px_20px_rgba(155,27,75,0.06)] transition hover:shadow-[0_10px_28px_rgba(155,27,75,0.1)] sm:flex-row sm:items-stretch"
      style={{ borderColor: MATCHMAKER_THEME.border }}
    >
      {profileHref ? (
        <Link href={profileHref} className="relative block shrink-0 sm:w-[38%] md:w-[40%]">
          {imageBlock}
        </Link>
      ) : (
        imageBlock
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3.5 sm:gap-2.5 sm:px-4 sm:py-3.5">
        {profileHref ? (
          <Link href={profileHref} className="block space-y-2">
            {summaryBlock}
          </Link>
        ) : (
          <div className="space-y-2">{summaryBlock}</div>
        )}

        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <MatchMakerPoolCardActions
            preview={preview}
            onPass={onPass}
            onExpressInterest={onExpressInterest}
            expressBusy={expressBusy}
            compact
            className="mt-1 border-t border-[#EDE0D4]/80 pt-2.5"
          />
        </div>
      </div>

      {profileHref ? (
        <Link
          href={profileHref}
          className="hidden w-9 shrink-0 items-center justify-center border-l text-muted transition group-hover:text-primary sm:flex"
          style={{ borderColor: `${MATCHMAKER_THEME.border}66`, background: MATCHMAKER_THEME.surfaceWarm }}
          aria-hidden
        >
          <IoChevronForward size={18} className="opacity-50 group-hover:opacity-100" />
        </Link>
      ) : null}
    </article>
  );
}
