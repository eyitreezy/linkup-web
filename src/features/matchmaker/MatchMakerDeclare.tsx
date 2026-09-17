'use client';

import { MatchMakerLayout, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { saveMatchMakerIntent } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MatchMakerDeclare() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!user?.id || !checked) return;
    setBusy(true);
    setError(null);
    const { error: saveError } = await saveMatchMakerIntent(createClient(), user.id);
    setBusy(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    router.replace('/matchmaker/values');
  }

  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold">Before you enter MatchMaker</h1>
        <p className="mt-4 text-[15px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          MatchMaker is built for one purpose: to help serious-minded individuals find a long-term relationship
          with the potential for marriage.
        </p>
        <label className="mt-8 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: MATCHMAKER_THEME.border }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          <span className="text-[14px] font-semibold leading-relaxed">
            I am entering MatchMaker with the sincere intention of finding a long-term relationship with the
            potential for marriage.
          </span>
        </label>
        {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
        <div className="mt-8">
          <MatchMakerPrimaryButton disabled={!checked || busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'I confirm this declaration'}
          </MatchMakerPrimaryButton>
        </div>
      </div>
    </MatchMakerLayout>
  );
}
