'use client';

import { MatchMakerLayout, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME, matchmakerContentClass } from '@/lib/matchmaker/theme';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import Link from 'next/link';

export function MatchMakerReflect() {
  return (
    <MatchMakerLayout>
      <div className={`${matchmakerContentClass()} py-16 text-center`}>
        <MatchMakerTabIcon size={40} className="mx-auto text-[#9B1B4B]/60" />
        <h1 className="mt-6 font-display text-2xl font-extrabold">Take a moment.</h1>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Reflect on what you experienced. We will be here when you are ready. Discover and all other LinkUp
          features remain fully accessible.
        </p>
        <textarea
          placeholder="What did you learn from this connection? (optional, private)"
          className="mt-8 min-h-[120px] w-full rounded-2xl border p-4 text-[14px] font-semibold"
          style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surfaceWarm }}
        />
        <div className="mt-6">
          <MatchMakerPrimaryButton onClick={() => {}}>Save privately</MatchMakerPrimaryButton>
        </div>
        <Link href="/discover" className="mt-6 inline-block text-[13px] font-semibold underline text-primary">
          Browse Discover
        </Link>
      </div>
    </MatchMakerLayout>
  );
}
