'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { onboardingFieldClass } from '@/lib/onboarding/formFieldClass';
import { saveMatchMakerValues } from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoArrowBack } from 'react-icons/io5';

const TOTAL_STEPS = 4;

const FAMILY_DB: Record<string, string> = {
  yes: 'yes_want_children',
  open: 'open_to_it',
  no: 'no_children',
  have_open: 'have_open_more',
  have_not: 'have_not_open_more',
};

const PACE_DB: Record<string, string> = {
  asap: 'asap_21_days',
  '1_2': 'one_two_months',
  '3_6': 'three_six_months',
  long: 'six_plus_months',
};

const COMMUNICATION_LABELS: Record<string, string> = {
  daily: 'Daily contact',
  few_times_week: 'A few times a week',
  flexible: 'Flexible',
};

function StepProgress({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mb-6 space-y-2">
      <div className="flex justify-between text-[12px] font-extrabold text-muted">
        <span>Step {step} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EDE8FF]">
        <div
          className="h-full rounded-full linkup-gradient-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type DealbreakersState = {
  faith: boolean;
  family: boolean;
  location: boolean;
  age: boolean;
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
};

function buildDealbreakers(db: DealbreakersState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (db.faith) out.faith_alignment = true;
  if (db.family) out.family_goals_alignment = true;
  if (db.location) out.max_distance_km = db.maxDistanceKm;
  if (db.age) {
    out.age_min = db.ageMin;
    out.age_max = db.ageMax;
  }
  return out;
}

function faithDbValue(faith: string | null, faithType: string | null): string | null {
  if (faith === 'yes') return faithType;
  if (faith === 'open') return 'open';
  if (faith === 'skip') return null;
  return null;
}

export function MatchMakerValuesScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [faith, setFaith] = useState<string | null>(null);
  const [faithType, setFaithType] = useState<string | null>(null);
  const [family, setFamily] = useState<string | null>(null);
  const [pace, setPace] = useState<string | null>(null);
  const [dealbreakers, setDealbreakers] = useState<DealbreakersState>({
    faith: false,
    family: false,
    location: false,
    age: false,
    maxDistanceKm: 25,
    ageMin: 22,
    ageMax: 35,
  });
  const [communicationStyle, setCommunicationStyle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void fetchUserProfileBundle(createClient(), user.id).then((bundle) => {
      const style = bundle.profile?.communication_style ?? null;
      if (style) setCommunicationStyle(style);
    });
  }, [user?.id]);

  const stepValid = useMemo(() => {
    if (step === 1) return faith !== null && (faith !== 'yes' || faithType !== null);
    if (step === 2) return family !== null;
    if (step === 3) return pace !== null;
    return true;
  }, [step, faith, faithType, family, pace]);

  function handleContinue() {
    if (step < TOTAL_STEPS) {
      if (!stepValid) return;
      setStep((s) => s + 1);
      return;
    }
    void submit();
  }

  async function submit() {
    if (!user?.id || !family || !pace) return;
    setBusy(true);
    setError(null);
    const { error: saveError } = await saveMatchMakerValues(createClient(), user.id, {
      faith: faithDbValue(faith, faithType),
      family_goals: FAMILY_DB[family],
      pace_preference: PACE_DB[pace],
      communication_frequency: communicationStyle,
      dealbreakers: buildDealbreakers(dealbreakers),
    });
    setBusy(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    router.replace('/matchmaker');
  }

  const privateLabel = 'This is private and never shown to others.';

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="pt-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="mb-4 flex items-center gap-1 text-[14px] font-extrabold text-muted"
          >
            <IoArrowBack size={18} />
            Back
          </button>
        ) : null}

        <StepProgress step={step} total={TOTAL_STEPS} />

        {step === 1 ? (
          <FormCard>
            {communicationStyle ? (
              <div
                className="mb-5 rounded-xl border border-[#EDE0D4] bg-[#FBF5F0] px-4 py-3"
              >
                <p className="text-[12px] font-semibold text-muted">From your LinkUp profile</p>
                <p className="mt-1 text-[14px] font-extrabold text-foreground">
                  Communication style: {COMMUNICATION_LABELS[communicationStyle] ?? communicationStyle}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-muted">
                  You can update this in MatchMaker settings anytime.
                </p>
              </div>
            ) : null}

            <h2 className="font-display text-xl font-extrabold text-foreground">
              Does faith matter to you in a relationship?
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-muted">{privateLabel}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { key: 'yes', label: 'Yes, faith is important to me' },
                { key: 'open', label: 'Open, faith is not a deciding factor for me' },
                { key: 'skip', label: 'Prefer not to say' },
              ].map((opt) => (
                <GradientChip
                  key={opt.key}
                  label={opt.label}
                  selected={faith === opt.key}
                  onClick={() => {
                    setFaith(opt.key);
                    if (opt.key !== 'yes') setFaithType(null);
                  }}
                />
              ))}
            </div>

            {faith === 'yes' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {['Christianity', 'Islam', 'Other faith', 'Prefer not to specify'].map((f) => (
                  <GradientChip
                    key={f}
                    label={f}
                    selected={faithType === f}
                    onClick={() => setFaithType(f)}
                  />
                ))}
              </div>
            ) : null}
          </FormCard>
        ) : null}

        {step === 2 ? (
          <FormCard>
            <h2 className="font-display text-xl font-extrabold text-foreground">
              What are your goals around children?
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-muted">{privateLabel}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { key: 'yes', label: 'Yes, I want children' },
                { key: 'open', label: 'Open to it' },
                { key: 'no', label: 'No, I do not want children' },
                { key: 'have_open', label: 'I have children and am open to more' },
                { key: 'have_not', label: 'I have children, but I am not open to more' },
              ].map((opt) => (
                <GradientChip
                  key={opt.key}
                  label={opt.label}
                  selected={family === opt.key}
                  onClick={() => setFamily(opt.key)}
                />
              ))}
            </div>
          </FormCard>
        ) : null}

        {step === 3 ? (
          <FormCard>
            <h2 className="font-display text-xl font-extrabold text-foreground">
              How long after connecting do you expect to meet?
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-muted">{privateLabel}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { key: 'asap', label: 'As soon as the platform allows (21 day minimum)' },
                { key: '1_2', label: '1 to 2 months' },
                { key: '3_6', label: '3 to 6 months' },
                { key: 'long', label: 'I take my time, 6 months or more' },
              ].map((opt) => (
                <GradientChip
                  key={opt.key}
                  label={opt.label}
                  selected={pace === opt.key}
                  onClick={() => setPace(opt.key)}
                />
              ))}
            </div>
          </FormCard>
        ) : null}

        {step === 4 ? (
          <FormCard>
            <h2 className="font-display text-xl font-extrabold text-foreground">
              Are there absolute dealbreakers for you?
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-muted">
              These are private hard filters. Profiles that do not meet them are silently excluded
              before you see them. They are never disclosed to anyone.
            </p>

            <div className="mt-4 space-y-1">
              <ToggleRow
                label="Faith alignment must match"
                checked={dealbreakers.faith}
                onChange={(v) => setDealbreakers((d) => ({ ...d, faith: v }))}
              />
              <ToggleRow
                label="Family goals must align"
                checked={dealbreakers.family}
                onChange={(v) => setDealbreakers((d) => ({ ...d, family: v }))}
              />
              <ToggleRow
                label="Must be within distance range"
                checked={dealbreakers.location}
                onChange={(v) => setDealbreakers((d) => ({ ...d, location: v }))}
              />
              {dealbreakers.location ? (
                <div className="px-1 pb-3">
                  <label className="text-[12px] font-extrabold text-muted">Maximum distance (km)</label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={dealbreakers.maxDistanceKm}
                    onChange={(e) =>
                      setDealbreakers((d) => ({
                        ...d,
                        maxDistanceKm: Number(e.target.value) || d.maxDistanceKm,
                      }))
                    }
                    className={onboardingFieldClass}
                  />
                </div>
              ) : null}
              <ToggleRow
                label="Must be within age range"
                checked={dealbreakers.age}
                onChange={(v) => setDealbreakers((d) => ({ ...d, age: v }))}
              />
              {dealbreakers.age ? (
                <div className="flex gap-3 px-1 pb-3">
                  <div className="flex-1">
                    <label className="text-[12px] font-extrabold text-muted">Min age</label>
                    <input
                      type="number"
                      min={18}
                      max={80}
                      value={dealbreakers.ageMin}
                      onChange={(e) =>
                        setDealbreakers((d) => ({
                          ...d,
                          ageMin: Number(e.target.value) || d.ageMin,
                        }))
                      }
                      className={onboardingFieldClass}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[12px] font-extrabold text-muted">Max age</label>
                    <input
                      type="number"
                      min={18}
                      max={80}
                      value={dealbreakers.ageMax}
                      onChange={(e) =>
                        setDealbreakers((d) => ({
                          ...d,
                          ageMax: Number(e.target.value) || d.ageMax,
                        }))
                      }
                      className={onboardingFieldClass}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </FormCard>
        ) : null}

        {error ? <p className="mt-4 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={busy || (step < TOTAL_STEPS && !stepValid)}
          className="mt-6 w-full min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Saving…' : step < TOTAL_STEPS ? 'Continue' : 'Save and enter MatchMaker'}
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
