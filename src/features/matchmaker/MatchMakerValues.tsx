'use client';

import { MatchMakerLayout, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { saveMatchMakerValues } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const FAMILY_GOALS = [
  'yes_want_children',
  'open_to_it',
  'no_children',
  'have_open_more',
  'have_not_open_more',
] as const;

const PACE = ['asap_21_days', 'one_two_months', 'three_six_months', 'six_plus_months'] as const;

export function MatchMakerValues() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [faith, setFaith] = useState<string | null>(null);
  const [familyGoals, setFamilyGoals] = useState<string>(FAMILY_GOALS[0]);
  const [pace, setPace] = useState<string>(PACE[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!user?.id) return;
    setBusy(true);
    setError(null);
    const { error: saveError } = await saveMatchMakerValues(createClient(), user.id, {
      faith,
      family_goals: familyGoals,
      pace_preference: pace,
      communication_frequency: null,
      dealbreakers: {},
    });
    setBusy(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    router.replace('/matchmaker');
  }

  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold">Your values</h1>
        <p className="text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Private — never shown on your profile.
        </p>

        <section>
          <h2 className="text-[15px] font-extrabold">Does faith matter to you in a relationship?</h2>
          <div className="mt-3 space-y-2">
            {[
              { value: 'important', label: 'Yes — faith is important to me' },
              { value: 'open', label: 'Open — faith is not a deciding factor' },
              { value: 'prefer_not', label: 'Prefer not to say' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFaith(opt.value)}
                className="w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold"
                style={{
                  borderColor: faith === opt.value ? MATCHMAKER_THEME.primary : MATCHMAKER_THEME.border,
                  background: faith === opt.value ? '#F0EEFF' : MATCHMAKER_THEME.surface,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[15px] font-extrabold">Family goals</h2>
          <select
            value={familyGoals}
            onChange={(e) => setFamilyGoals(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold"
            style={{ borderColor: MATCHMAKER_THEME.border }}
          >
            <option value="yes_want_children">Yes — I want children</option>
            <option value="open_to_it">Open to it</option>
            <option value="no_children">No — I do not want children</option>
            <option value="have_open_more">I already have children and am open to more</option>
            <option value="have_not_open_more">I already have children and am not open to more</option>
          </select>
        </section>

        <section>
          <h2 className="text-[15px] font-extrabold">Pace preference</h2>
          <select
            value={pace}
            onChange={(e) => setPace(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold"
            style={{ borderColor: MATCHMAKER_THEME.border }}
          >
            <option value="asap_21_days">As soon as the platform allows (21 days minimum)</option>
            <option value="one_two_months">1 to 2 months</option>
            <option value="three_six_months">3 to 6 months</option>
            <option value="six_plus_months">6 months or more</option>
          </select>
        </section>

        {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <MatchMakerPrimaryButton disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Save and enter MatchMaker'}
        </MatchMakerPrimaryButton>
      </div>
    </MatchMakerLayout>
  );
}
