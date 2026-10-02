'use client';

import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { onboardingFieldClass } from '@/lib/onboarding/formFieldClass';
import {
  hasCompleteMatchMakerValues,
  parseDealbreakersFromDb,
  parseFaithFromDb,
  parseFamilyFromDb,
  parsePaceFromDb,
  type DealbreakersFormState,
  type MatchMakerValuesRow,
} from '@/lib/matchmaker/valuesFormHydrate';
import { saveMatchMakerValues } from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoArrowBack, IoClose, IoCreateOutline } from 'react-icons/io5';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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

const COMMUNICATION_OPTIONS = [
  { value: 'daily', label: 'Daily contact', sub: 'I like staying in touch regularly' },
  { value: 'few_times_week', label: 'A few times a week', sub: 'Regular but not every day' },
  { value: 'flexible', label: 'Flexible', sub: 'I go with the flow' },
] as const;

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

function sanitizeDigitsInput(value: string, maxLength = 3): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function parseBoundedInt(value: string, min: number, max: number, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildDealbreakers(db: DealbreakersFormState, otherTags: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (db.faith) out.faith_alignment = true;
  if (db.family) out.family_goals_alignment = true;
  if (db.location) out.max_distance_km = parseBoundedInt(db.maxDistanceKm, 5, 200, 25);
  if (db.age) {
    out.age_min = parseBoundedInt(db.ageMin, 18, 80, 22);
    out.age_max = parseBoundedInt(db.ageMax, 18, 80, 35);
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

function parseEntryStep(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : 1;
  return n >= 1 && n <= TOTAL_STEPS ? n : 1;
}

export function MatchMakerValuesScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fromSettings = searchParams.get('from') === 'settings';
  const focusCommunication = searchParams.get('focus') === 'communication';
  const entryStep = parseEntryStep(searchParams.get('step'));
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [faith, setFaith] = useState<string | null>(null);
  const [faithType, setFaithType] = useState<string | null>(null);
  const [otherFaithText, setOtherFaithText] = useState('');
  const [family, setFamily] = useState<string | null>(null);
  const [pace, setPace] = useState<string | null>(null);
  const [dealbreakers, setDealbreakers] = useState<DealbreakersFormState>({
    faith: false,
    family: false,
    location: false,
    age: false,
    other: false,
    maxDistanceKm: '25',
    ageMin: '22',
    ageMax: '35',
  });
  const [otherDealbreakers, setOtherDealbreakers] = useState<string[]>([]);
  const [otherDbInput, setOtherDbInput] = useState('');
  const [communicationStyle, setCommunicationStyle] = useState<string | null>(null);
  const [showCommEditor, setShowCommEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commStyleRef = useRef<HTMLDivElement | null>(null);

  const valuesQuery = useQuery({
    queryKey: ['matchmaker-values-form', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user!.id);
      const { data: values, error } = await client
        .from('matchmaker_values')
        .select('faith, family_goals, pace_preference, communication_frequency, dealbreakers')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        bundle,
        values: values as MatchMakerValuesRow | null,
      };
    },
  });

  const profileCommunicationStyle =
    (valuesQuery.data?.bundle?.profile as { communication_style?: string | null } | undefined)
      ?.communication_style ?? null;

  const effectiveCommunicationStyle = communicationStyle ?? profileCommunicationStyle;

  useEffect(() => {
    if (!valuesQuery.data || hydrated) return;

    const { bundle, values } = valuesQuery.data;
    const profileComm =
      (bundle.profile as { communication_style?: string | null } | undefined)?.communication_style ??
      null;

    if (values) {
      const faithState = parseFaithFromDb(values.faith);
      setFaith(faithState.faith);
      setFaithType(faithState.faithType);
      setOtherFaithText(faithState.otherFaithText);
      setFamily(parseFamilyFromDb(values.family_goals));
      setPace(parsePaceFromDb(values.pace_preference));
      const dbParsed = parseDealbreakersFromDb(values.dealbreakers);
      setDealbreakers(dbParsed.dealbreakers);
      setOtherDealbreakers(dbParsed.otherDealbreakers);
      const comm = values.communication_frequency ?? profileComm;
      if (comm) setCommunicationStyle(comm);
    } else if (profileComm) {
      setCommunicationStyle(profileComm);
    }

    setStep(entryStep);
    if (focusCommunication) setShowCommEditor(true);
    setHydrated(true);
  }, [valuesQuery.data, hydrated, entryStep, focusCommunication]);

  const settingsEditBlocked =
    fromSettings &&
    valuesQuery.isSuccess &&
    !hasCompleteMatchMakerValues(valuesQuery.data?.values ?? null);

  const stepValid = useMemo(() => {
    if (step === 1) {
      if (faith === null) return false;
      if (faith === 'yes' && !faithType) return false;
      if (faith === 'yes' && faithType === 'other' && !otherFaithText.trim()) return false;
      if (!effectiveCommunicationStyle) return false;
      return true;
    }
    if (step === 2) return family !== null;
    if (step === 3) return pace !== null;
    if (step === TOTAL_STEPS) return effectiveCommunicationStyle !== null;
    return true;
  }, [
    step,
    faith,
    faithType,
    otherFaithText,
    family,
    pace,
    effectiveCommunicationStyle,
  ]);

  function addOtherDealbreakerTag() {
    const trimmed = otherDbInput.trim();
    if (!trimmed || otherDealbreakers.includes(trimmed) || otherDealbreakers.length >= 10) return;
    setOtherDealbreakers((prev) => [...prev, trimmed]);
    setOtherDbInput('');
  }

  function handleContinue() {
    if (fromSettings) {
      void submit();
      return;
    }
    if (step < TOTAL_STEPS) {
      if (!stepValid) return;
      setStep((s) => s + 1);
      return;
    }
    void submit();
  }

  function handleBack() {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }
    if (fromSettings) {
      router.push('/matchmaker/settings');
    }
  }

  async function submit() {
    if (!user?.id || !family || !pace || !effectiveCommunicationStyle) return;
    setBusy(true);
    setError(null);
    const { error: saveError } = await saveMatchMakerValues(createClient(), user.id, {
      faith: faithDbValue(faith, faithType, otherFaithText),
      family_goals: FAMILY_DB[family],
      pace_preference: PACE_DB[pace],
      communication_frequency: effectiveCommunicationStyle,
      dealbreakers: buildDealbreakers(dealbreakers, otherDealbreakers),
    });
    setBusy(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['matchmaker-settings-bundle', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['profile-bundle', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['matchmaker-values-form', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['matchmaker-gate'] });
    router.replace(fromSettings ? '/matchmaker/settings' : '/matchmaker');
  }

  const privateLabel = 'This is private and never shown to others.';
  const showBack = step > 1 || fromSettings;

  if (valuesQuery.isLoading || !hydrated) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <div className="space-y-4">
            <div className="h-8 w-40 animate-pulse rounded-full bg-[#EDE8FF]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[#FBF5F0]" />
          </div>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (valuesQuery.isError) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-[14px] font-semibold text-[#EF4444]">
            Could not load your MatchMaker values. Please try again.
          </p>
          <button
            type="button"
            onClick={() => void valuesQuery.refetch()}
            className="mt-4 min-h-[44px] rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white"
          >
            Retry
          </button>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (settingsEditBlocked) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-[14px] font-semibold text-foreground">
            Complete MatchMaker values setup before editing individual fields.
          </p>
          <button
            type="button"
            onClick={() => router.push('/matchmaker/settings')}
            className="mt-4 min-h-[44px] rounded-full border border-border bg-white px-6 text-[14px] font-extrabold"
          >
            Back to settings
          </button>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  const primaryLabel = fromSettings
    ? 'Save changes'
    : step < TOTAL_STEPS
      ? 'Continue'
      : 'Save and enter MatchMaker';

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="mb-4 flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-white px-4 text-[14px] font-extrabold text-foreground transition hover:border-primary/30 hover:bg-[#F8F7FF]"
          >
            <IoArrowBack size={16} />
            Back
          </button>
        ) : null}

        <StepProgress step={step} total={TOTAL_STEPS} />

        {step === 1 ? (
          <FormCard>
            {profileCommunicationStyle && !showCommEditor ? (
              <div className="mb-5 rounded-xl border border-[#EDE0D4] bg-[#FBF5F0] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-muted">From your LinkUp profile</p>
                    <p className="mt-1 text-[14px] font-extrabold text-foreground">
                      Communication style:{' '}
                      {COMMUNICATION_LABELS[effectiveCommunicationStyle ?? ''] ??
                        effectiveCommunicationStyle}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Edit communication style"
                    aria-label="Edit communication style"
                    onClick={() => {
                      setShowCommEditor(true);
                      commStyleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-primary transition hover:border-primary/35 hover:bg-white"
                  >
                    <IoCreateOutline size={18} aria-hidden />
                  </button>
                </div>
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

            {!profileCommunicationStyle || showCommEditor ? (
              <div
                id="communication-style"
                ref={commStyleRef}
                className={cn(profileCommunicationStyle || faith !== null ? 'mt-6 border-t border-border pt-6' : '')}
              >
                <h3 className="text-[15px] font-extrabold text-foreground">
                  How do you prefer to communicate?
                </h3>
                <p className="mt-1 text-[12px] font-semibold text-muted">
                  Required for MatchMaker. This stays private on your profile.
                </p>
                <div className="mt-3 space-y-2">
                  {COMMUNICATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCommunicationStyle(opt.value)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                        effectiveCommunicationStyle === opt.value
                          ? 'border-primary bg-[#F0EEFF]'
                          : 'border-border bg-surface'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          effectiveCommunicationStyle === opt.value
                            ? 'border-primary bg-primary'
                            : 'border-border'
                        )}
                      >
                        {effectiveCommunicationStyle === opt.value ? (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        ) : null}
                      </span>
                      <span>
                        <span className="block text-[14px] font-extrabold text-foreground">{opt.label}</span>
                        <span className="block text-[11px] font-semibold text-muted">{opt.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={dealbreakers.maxDistanceKm}
                    onChange={(e) =>
                      setDealbreakers((d) => ({
                        ...d,
                        maxDistanceKm: sanitizeDigitsInput(e.target.value, 3),
                      }))
                    }
                    className={onboardingFieldClass}
                    aria-label="Maximum distance in kilometres"
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
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={dealbreakers.ageMin}
                      onChange={(e) =>
                        setDealbreakers((d) => ({
                          ...d,
                          ageMin: sanitizeDigitsInput(e.target.value, 2),
                        }))
                      }
                      className={onboardingFieldClass}
                      aria-label="Minimum age"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[12px] font-extrabold text-muted">Max age</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={dealbreakers.ageMax}
                      onChange={(e) =>
                        setDealbreakers((d) => ({
                          ...d,
                          ageMax: sanitizeDigitsInput(e.target.value, 2),
                        }))
                      }
                      className={onboardingFieldClass}
                      aria-label="Maximum age"
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
            disabled={busy || !stepValid}
            className={cn(
              'min-h-[48px] rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50',
              step < TOTAL_STEPS ? 'min-w-[160px]' : 'min-w-[280px]'
            )}
          >
            {busy ? 'Saving…' : primaryLabel}
          </button>
        </div>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
