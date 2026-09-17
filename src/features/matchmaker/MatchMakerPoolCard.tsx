'use client';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { MatchMakerCard, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';

type Props = {
  profile: PoolProfileRow;
  preview?: boolean;
  signals?: string[];
  onPass?: () => void;
  onExpressInterest?: () => void;
  expressBusy?: boolean;
};

export function MatchMakerPoolCard({
  profile,
  preview = false,
  signals = [],
  onPass,
  onExpressInterest,
  expressBusy = false,
}: Props) {
  const age = ageFromBirthDate(profile.birth_date);

  return (
    <MatchMakerCard>
      <div className="flex flex-col items-center text-center">
        <ProfileAvatar
          profile={{
            primary_photo_url: profile.primary_photo_url ?? null,
            photo_urls: profile.photo_urls ?? null,
            avatar_url: profile.avatar_url ?? null,
          }}
          displayName={profile.display_name ?? 'Member'}
          size={88}
          ringClassName="ring-2 ring-[#9B1B4B]/30"
        />
        <h2 className="mt-4 font-display text-xl font-extrabold">
          {profile.display_name}
          {age != null ? `, ${age}` : ''}
        </h2>
        {profile.location_label ? (
          <p className="mt-1 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            {profile.location_label}
          </p>
        ) : null}
      </div>

      {signals.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {signals.map((s) => (
            <span
              key={s}
              className="rounded-full border px-3 py-1 text-[12px] font-extrabold"
              style={{
                borderColor: MATCHMAKER_THEME.border,
                background: MATCHMAKER_THEME.surfaceWarm,
                color: MATCHMAKER_THEME.accent,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {!preview ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onPass}
            className="min-h-[48px] rounded-full border font-extrabold"
            style={{ borderColor: MATCHMAKER_THEME.disabled, color: MATCHMAKER_THEME.textMuted }}
          >
            Pass
          </button>
          <MatchMakerPrimaryButton disabled={expressBusy} onClick={onExpressInterest}>
            {expressBusy ? 'Sending…' : 'Express Interest'}
          </MatchMakerPrimaryButton>
        </div>
      ) : null}
    </MatchMakerCard>
  );
}
