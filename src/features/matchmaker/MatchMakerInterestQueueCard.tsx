'use client';

import {
  MatchMakerPoolCardActions,
  MatchMakerPoolCardSignals,
} from '@/features/matchmaker/MatchMakerPoolCardParts';
import { ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import { poolProfilePhotoUri } from '@/lib/matchmaker/poolCardUtils';
import { matchmakerProfileHref } from '@/lib/matchmaker/routes';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import type { MatchMakerInterestQueueRow } from '@/types/matchmaker-interests';
import Link from 'next/link';
import { IoChevronForward, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  row: MatchMakerInterestQueueRow;
  signals?: string[];
  mode: 'sent' | 'received';
  onPass?: () => void;
  onExpressInterest?: () => void;
  expressBusy?: boolean;
};

export function MatchMakerInterestQueueCard({
  row,
  signals = [],
  mode,
  onPass,
  onExpressInterest,
  expressBusy = false,
}: Props) {
  const age = ageFromBirthDate(row.birth_date);
  const photo = poolProfilePhotoUri(row);
  const displayName = row.display_name?.trim() || 'Member';
  const profileHref = matchmakerProfileHref(row.user_id);
  const signal = signals[0];

  return (
    <article
      className="group flex w-full min-w-0 items-stretch gap-3 rounded-2xl border bg-white p-3.5 shadow-[0_6px_20px_rgba(155,27,75,0.06)] transition hover:shadow-[0_10px_28px_rgba(155,27,75,0.1)] sm:gap-4 sm:p-4"
      style={{ borderColor: MATCHMAKER_THEME.border }}
    >
      <Link href={profileHref} className="relative shrink-0">
        <div
          className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-[#EDE0D4]"
          style={{ background: MATCHMAKER_THEME.surfaceWarm }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted/70">
              {displayName.charAt(0)}
            </div>
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={profileHref} className="block">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className="line-clamp-1 font-display text-[15px] font-extrabold leading-snug"
                style={{ color: MATCHMAKER_THEME.textPrimary }}
              >
                {displayName}
                {age != null ? `, ${age}` : ''}
              </h3>
              {row.location_label ? (
                <p className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  {row.location_label}
                </p>
              ) : null}
            </div>
            {row.verified_badge ? (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold"
                style={{ background: `${MATCHMAKER_THEME.accent}18`, color: MATCHMAKER_THEME.accent }}
              >
                <IoShieldCheckmark size={10} />
              </span>
            ) : null}
          </div>
          {signal ? (
            <MatchMakerPoolCardSignals signals={[signal]} compact className="mt-2" />
          ) : null}
        </Link>

        {mode === 'received' ? (
          <div className="mt-3 border-t border-[#EDE0D4]/80 pt-3" onClick={(e) => e.stopPropagation()}>
            <MatchMakerPoolCardActions
              onPass={onPass}
              onExpressInterest={onExpressInterest}
              expressBusy={expressBusy}
              compact
            />
          </div>
        ) : (
          <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.accent }}>
            Interest sent
          </p>
        )}
      </div>

      <Link
        href={profileHref}
        className="hidden shrink-0 items-center justify-center self-center text-muted transition group-hover:text-[#9B1B4B] sm:flex"
        aria-hidden
      >
        <IoChevronForward size={18} className="opacity-50 group-hover:opacity-100" />
      </Link>
    </article>
  );
}
