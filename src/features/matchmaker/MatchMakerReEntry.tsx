'use client';

import {
  MatchMakerLayout,
  MatchMakerPageShell,
  MatchMakerPrimaryButton,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { enterMatchMakerPool } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MatchMakerReEntry() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    const { error } = await enterMatchMakerPool(createClient());
    setBusy(false);
    if (!error) router.replace('/matchmaker');
  }

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="py-16 text-center">
        <MatchMakerTabIcon size={48} className="mx-auto animate-pulse text-[#9B1B4B]/80" />
        <h1 className="mt-6 font-display text-2xl font-extrabold">Ready when you are.</h1>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          We have updated your MatchMaker profile based on what you shared. Your pool is waiting.
        </p>
        <div className="mt-10">
          <MatchMakerPrimaryButton disabled={busy} onClick={() => void enter()}>
            {busy ? 'Opening…' : 'Enter MatchMaker'}
          </MatchMakerPrimaryButton>
        </div>
        <p className="mt-6 text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          There is no rush. This will be here whenever you feel ready.
        </p>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
