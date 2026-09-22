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
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoArrowBack, IoClose } from 'react-icons/io5';

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

const FAITH_TYPE_OPTIONS = [
  { key: 'Christianity', label: 'Christianity' },
  { key: 'Islam', label: 'Islam' },
  { key: 'other', label: 'Other faith' },
  { key: 'Prefer not to specify', label: 'Prefer not to specify' },
] as const;

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
  other: boolean;
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
};

function buildDealbreakers(db: DealbreakersState, otherTags: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (db.faith) out.faith_alignment = true;
  if (db.family) out.family_goals_alignment = true;
  if (db.location) out.max_distance_km = db.maxDistanceKm;
  if (db.age) {
    out.age_min = db.ageMin;
    out.age_max = db.ageMax;
  }
  if (db.other && otherTags.length > 0) {
    out.other = otherTags;
  }
  return out;
}

function faithDbValue(
  faith: string | null,
  faithType: string | null,
  otherFaithText: string
): string | null {
  if (faith === 'yes') {
    if (faithType === 'other') return `other:${otherFaithText.trim()}`;
    return faithType;
  }
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
  const [otherFaithText, setOtherFaithText] = useState('');
  const [family, setFamily] = useState<string | null>(null);
  const [pace, setPace] = useState<string | null>(null);
  const [dealbreakers, setDealbreakers] = useState<DealbreakersState>({
    faith: false,
    family: false,
    location: false,
    age: false,
    other: false,
    maxDistanceKm: 25,
    ageMin: 22,
    ageMax: 35,
  });
  const [otherDealbreakers, setOtherDealbreakers] = useState<string[]>([]);
  const [otherDbInput, setOtherDbInput] = useState('');
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
    if (step === 1) {
      if (faith === null) return false;
      if (faith === 'yes' && !faithType) return false;
      if (faith === 'yes' && faithType === 'other' && !otherFaithText.trim()) return false;
      return true;
    }
    if (step === 2) return family !== null;
    if (step === 3) return pace !== null;
    return true;
  }, [step, faith, faithType, otherFaithText, family, pace]);

  function addOtherDealbreakerTag() {
    const trimmed = otherDbInput.trim();
    if (!trimmed || otherDealbreakers.includes(trimmed) || otherDealbreakers.length >= 10) return;
    setOtherDealbreakers((prev) => [...prev, trimmed]);
    setOtherDbInput('');
  }

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
      faith: faithDbValue(faith, faithType, otherFaithText),
      family_goals: FAMILY_DB[family],
      pace_preference: PACE_DB[pace],
      communication_frequency: communicationStyle,
      dealbreakers: buildDealbreakers(dealbreakers, otherDealbreakers),
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
            className="mb-4 flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-white px-4 text-[14px] font-extrabold text-foreground transition hover:border-primary/30 hover:bg-[#F8F7FF]"
          >
            <IoArrowBack size={16} />
            Back
          </button>
        ) : null}

        <StepProgress step={step} total={TOTAL_STEPS} />

        {step === 1 ? (
          <FormCard>
            {communicationStyle ? (
              <div className="mb-5 rounded-xl border border-[#EDE0D4] bg-[#FBF5F0] px-4 py-3">
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
                    if (opt.key !== 'yes') {
                      setFaithType(null);
                      setOtherFaithText('');
                    }
                  }}
                />
              ))}
            </div>

            {faith === 'yes' ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FAITH_TYPE_OPTIONS.map((opt) => (
                    <GradientChip
                      key={opt.key}
                      label={opt.label}
                      selected={faithType === opt.key}
                      onClick={() => {
                        setFaithType(opt.key);
                        if (opt.key !== 'other') setOtherFaithText('');
                      }}
                    />
                  ))}
                </div>

                {faithType === 'other' ? (
                  <div className="mt-4 space-y-1">
                    <label className="block text-[12px] font-extrabold text-muted">
                      Please specify your faith
                    </label>
                    <input
                      type="text"
                      value={otherFaithText}
                      onChange={(e) => setOtherFaithText(e.target.value.slice(0, 50))}
                      placeholder="e.g. Hinduism, Buddhism, Sikhism..."
                      maxLength={50}
                      className={onboardingFieldClass}
                      autoFocus
                    />
                    <p className="text-right text-[11px] font-semibold text-muted">
                      {otherFaithText.length}/50
                    </p>
                  </div>
                ) : null}
              </>
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
              <ToggleRow
                label="Other dealbreakers"
                hint="Add your own specific requirements"
                checked={dealbreakers.other}
                onChange={(v) => setDealbreakers((d) => ({ ...d, other: v }))}
              />
              {dealbreakers.other ? (
                <div className="mt-3 space-y-3 rounded-2xl border border-[#EDE0D4] bg-[#FBF5F0] p-4">
                  <p className="text-[13px] font-extrabold text-foreground">Your dealbreakers</p>
                  <p className="text-[12px] font-semibold text-muted">
                    Add specific requirements that matter to you. Max 10.
                  </p>

                  {otherDealbreakers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {otherDealbreakers.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#EDE0D4] bg-white px-3 py-1.5 text-[13px] font-extrabold text-foreground"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() =>
                              setOtherDealbreakers((prev) => prev.filter((t) => t !== tag))
                            }
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-muted/20 text-muted transition hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                            aria-label={`Remove ${tag}`}
                          >
                            <IoClose size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {otherDealbreakers.length < 10 ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otherDbInput}
                        onChange={(e) => setOtherDbInput(e.target.value.slice(0, 60))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addOtherDealbreakerTag();
                          }
                        }}
                        placeholder="e.g. Must not smoke"
                        maxLength={60}
                        className={cn(onboardingFieldClass, 'flex-1')}
                      />
                      <button
                        type="button"
                        onClick={addOtherDealbreakerTag}
                        disabled={
                          !otherDbInput.trim() ||
                          otherDealbreakers.includes(otherDbInput.trim())
                        }
                        className="min-h-[44px] rounded-full linkup-gradient-primary px-5 text-[13px] font-extrabold text-white disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <p className="text-[12px] font-semibold text-muted">
                      Maximum of 10 dealbreakers reached.
                    </p>
                  )}

                  <p className="text-right text-[11px] font-semibold text-muted">
                    {otherDbInput.length}/60
                  </p>
                </div>
              ) : null}
            </div>
          </FormCard>
        ) : null}

        {error ? <p className="mt-4 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleContinue}
            disabled={busy || (step < TOTAL_STEPS && !stepValid)}
            className={cn(
              'min-h-[48px] rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50',
              step < TOTAL_STEPS ? 'min-w-[160px]' : 'min-w-[280px]'
            )}
          >
            {busy ? 'Saving…' : step < TOTAL_STEPS ? 'Continue' : 'Save and enter MatchMaker'}
          </button>
        </div>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
