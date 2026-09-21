'use client';

import {
  MatchMakerLayout,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import Link from 'next/link';

export function MatchMakerReEntry() {
  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="py-16 text-center">
        <MatchMakerTabIcon size={48} className="mx-auto text-[#9B1B4B]/70" />
        <h1 className="mt-6 font-display text-2xl font-extrabold">Ready when you are.</h1>
        <p className="mt-3 text-[15px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          We have updated your MatchMaker profile based on what you shared. Your pool is waiting.
        </p>
        <div className="mt-10">
          <Link href="/matchmaker">
            <MatchMakerPrimaryButton>Enter MatchMaker</MatchMakerPrimaryButton>
          </Link>
        </div>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
