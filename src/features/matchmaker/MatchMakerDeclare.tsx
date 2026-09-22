'use client';

import { FormCard } from '@/components/settings/FormCard';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { saveMatchMakerIntent } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
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
      <MatchMakerPageShell>
        <h1 className="font-display text-2xl font-extrabold">Before you enter MatchMaker</h1>
        <p className="mt-4 text-[15px] font-semibold leading-relaxed text-muted">
          MatchMaker is built for one purpose: to help serious-minded individuals find a long-term
          relationship with the potential for marriage.
        </p>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-muted">
          It is not a casual dating feature, a friendship finder, or an exploratory social tool.
        </p>

        <FormCard className="mt-8">
          <p className="text-center text-[16px] font-semibold italic" style={{ color: MATCHMAKER_THEME.accent }}>
            One person. One connection. One intention.
          </p>
        </FormCard>

        <FormCard className="mt-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-[14px] font-semibold leading-relaxed text-foreground">
              I am entering MatchMaker with the sincere intention of finding a long-term relationship
              with the potential for marriage. I understand that this feature is designed for
              serious-minded individuals and that my behaviour within MatchMaker will be held to that
              standard.
            </span>
          </label>
        </FormCard>

        {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <button
          type="button"
          disabled={!checked || busy}
          onClick={() => void submit()}
          className="mt-8 w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'I confirm this declaration'}
        </button>

        <Link
          href="/matchmaker"
          className="mt-4 block text-center text-[13px] font-semibold text-muted underline"
        >
          Go back
        </Link>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
