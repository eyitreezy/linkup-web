'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { ProfileMediaManager } from '@/features/profile/ProfileMediaManager';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { HINGE_PROMPTS, INTEREST_TAGS, LANGUAGE_OPTIONS, ONBOARDING_STEP_LABELS, ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { ageFromBirthDate, draftFromProfile } from '@/lib/onboarding/hydrate';
import { finalizeOnboarding, persistOnboardingResumeStep, saveOnboardingStep } from '@/lib/onboarding/persist';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { profileMediaMeetsMinimums, profileMediaValidationMessage } from '@/lib/profile/media/validation';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileVideo } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { MeetingIntent } from '@/types/onboarding';
import { defaultOnboardingDraft, type OnboardingDraft } from '@/types/onboarding';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoSparkles } from 'react-icons/io5';

const INTENTS: { id: MeetingIntent; label: string }[] = [
  { id: 'friendship', label: 'Friendship' },
  { id: 'dating', label: 'Dating' },
  { id: 'activity', label: 'Activities' },
  { id: 'networking', label: 'Networking' },
];

export function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const video = await fetchProfileVideo(client, user.id);
      return { ...bundle, video };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!data?.profile) return;
    setDraft(draftFromProfile(data.profile, data.video));
    if (data.profile.onboarding_status === 'pending') {
      const raw = data.profile.preferences?.onboarding_step;
      const idx =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.max(0, Math.min(Math.floor(raw), ONBOARDING_TOTAL_STEPS - 1))
          : 0;
      setStep(idx);
    }
  }, [data?.profile, data?.video]);

  const canContinue = useMemo(() => {
    if (step === 0) {
      const age = ageFromBirthDate(draft.birthDate);
      return (
        draft.displayName.trim().length >= 1 &&
        draft.adultConfirmed &&
        age >= 18 &&
        profileMediaMeetsMinimums(draft.profileMedia)
      );
    }
    if (step === 1) {
      const filled = draft.promptAnswers.filter((p) => p.answer.trim().length > 0);
      return (
        draft.interests.length >= 1 &&
        draft.languages.length >= 1 &&
        draft.meetingIntent != null &&
        filled.length >= 1 &&
        filled.length <= 2
      );
    }
    if (step === 2) return hasValidProfileLocation(draft);
    return true;
  }, [step, draft]);

  const continueHint = useMemo(() => {
    if (step === 0) {
      if (!draft.adultConfirmed) return 'Confirm you are 18+ to continue.';
      return profileMediaValidationMessage(draft.profileMedia);
    }
    if (step === 1) return 'Add interests, languages, intent, and 1–2 prompts.';
    if (step === 2) return 'Pick your location from search results.';
    return null;
  }, [step, draft]);

  async function handleContinue() {
    if (!user?.id || !canContinue) return;
    setSaving(true);
    setError(null);

    if (step < ONBOARDING_TOTAL_STEPS - 1) {
      const { error: err } = await saveOnboardingStep({
        userId: user.id,
        draft,
        existingPreferences: data?.profile?.preferences ?? null,
        stepIndex: step,
        existingVideoMediaId: data?.video?.id,
        existingVideoStoragePath: data?.video?.storagePath,
      });
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
      await persistOnboardingResumeStep({
        userId: user.id,
        stepIndex: step + 1,
        existingPreferences: data?.profile?.preferences ?? null,
      });
      setStep((s) => s + 1);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-bundle'] });
      return;
    }

    const { error: err } = await finalizeOnboarding({
      userId: user.id,
      draft,
      existingPreferences: data?.profile?.preferences ?? null,
      existingVideoMediaId: data?.video?.id,
      existingVideoStoragePath: data?.video?.storagePath,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
    router.push('/discover');
    router.refresh();
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to finish onboarding.
      </p>
    );
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <SettingsPageHeader
        kicker="Welcome"
        title="Set up your profile"
        subtitle="Photos, video, and basics — same quality bar as the LinkUp app."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ONBOARDING_STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold min-[400px]:text-[12px]',
              i === step ? 'linkup-gradient-primary text-white shadow-sm' : 'border border-border bg-white text-muted'
            )}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error ? <p className="text-[14px] font-extrabold text-red-600">{error}</p> : null}

      {step === 0 ? (
        <FormCard>
          <PremiumSectionHead title="Photos & video" />
          <label className="mt-3 block text-[13px] font-extrabold">Display name</label>
          <input
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
            value={draft.displayName}
            onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
          />
          <label className="mt-4 block text-[13px] font-extrabold">Birthday</label>
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
            value={draft.birthDate.toISOString().slice(0, 10)}
            onChange={(e) => {
              const [y, m, day] = e.target.value.split('-').map(Number);
              if (y && m && day) setDraft((d) => ({ ...d, birthDate: new Date(y, m - 1, day) }));
            }}
          />
          <ToggleRow
            label="I confirm I am 18 or older"
            checked={draft.adultConfirmed}
            onChange={(v) => setDraft((d) => ({ ...d, adultConfirmed: v }))}
          />
          <ProfileMediaManager
            className="mt-4"
            media={draft.profileMedia}
            onChange={(profileMedia) => setDraft((d) => ({ ...d, profileMedia }))}
          />
        </FormCard>
      ) : null}

      {step === 1 ? (
        <>
          <FormCard>
            <PremiumSectionHead title="Bio" />
            <textarea
              maxLength={150}
              className="mt-2 min-h-[80px] w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            />
          </FormCard>
          <FormCard>
            <PremiumSectionHead title="Interests & languages" />
            <div className="mt-2 flex flex-wrap gap-2">
              {INTEREST_TAGS.map((tag) => (
                <GradientChip
                  key={tag}
                  label={tag}
                  selected={draft.interests.includes(tag)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      interests: d.interests.includes(tag) ? d.interests.filter((x) => x !== tag) : [...d.interests, tag],
                    }))
                  }
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((tag) => (
                <GradientChip
                  key={tag}
                  label={tag}
                  selected={draft.languages.includes(tag)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      languages: d.languages.includes(tag) ? d.languages.filter((x) => x !== tag) : [...d.languages, tag],
                    }))
                  }
                />
              ))}
            </div>
          </FormCard>
          <FormCard>
            <PremiumSectionHead title="What you're here for" />
            <div className="mt-2 flex flex-wrap gap-2">
              {INTENTS.map((i) => (
                <GradientChip
                  key={i.id}
                  label={i.label}
                  selected={draft.meetingIntent === i.id}
                  onClick={() => setDraft((d) => ({ ...d, meetingIntent: i.id }))}
                />
              ))}
            </div>
          </FormCard>
          <FormCard>
            <PremiumSectionHead title="Prompts (1–2)" />
            {draft.promptAnswers.map((p, idx) => (
              <div key={p.promptId} className="mt-4 border-t border-border/60 pt-4 first:mt-0 first:border-0 first:pt-0">
                <select
                  className="w-full rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
                  value={p.promptId}
                  onChange={(e) => {
                    const pr = HINGE_PROMPTS.find((x) => x.id === e.target.value);
                    setDraft((d) => {
                      const next = [...d.promptAnswers];
                      next[idx] = { ...next[idx], promptId: e.target.value, prompt: pr?.text ?? '' };
                      return { ...d, promptAnswers: next };
                    });
                  }}
                >
                  {HINGE_PROMPTS.map((hp) => (
                    <option key={hp.id} value={hp.id}>
                      {hp.text}
                    </option>
                  ))}
                </select>
                <textarea
                  className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
                  value={p.answer}
                  onChange={(e) => {
                    setDraft((d) => {
                      const next = [...d.promptAnswers];
                      next[idx] = { ...next[idx], answer: e.target.value };
                      return { ...d, promptAnswers: next };
                    });
                  }}
                />
              </div>
            ))}
          </FormCard>
        </>
      ) : null}

      {step === 2 ? (
        <FormCard>
          <PremiumSectionHead title="Location" />
          <LocationSearchField
            value={draft.locationLabel}
            onChange={(label) => setDraft((d) => ({ ...d, locationLabel: label }))}
            onSelect={(s) =>
              setDraft((d) => ({
                ...d,
                locationLabel: s.label,
                locationLatitude: s.latitude,
                locationLongitude: s.longitude,
              }))
            }
          />
        </FormCard>
      ) : null}

      {step === 3 ? (
        <FormCard>
          <PremiumSectionHead title="Discovery preferences" />
          <ToggleRow
            label="Public profile"
            checked={draft.profilePublic}
            onChange={(v) => setDraft((d) => ({ ...d, profilePublic: v }))}
          />
          <p className="mt-3 text-[13px] font-semibold text-muted">
            Age {draft.ageMin}–{draft.ageMax}, radius {draft.radiusKm} km
          </p>
          <label className="mt-3 block text-[12px] font-extrabold">Min age</label>
          <input type="range" min={18} max={60} value={draft.ageMin} onChange={(e) => setDraft((d) => ({ ...d, ageMin: Number(e.target.value) }))} className="w-full" />
          <label className="mt-2 block text-[12px] font-extrabold">Max age</label>
          <input type="range" min={18} max={70} value={draft.ageMax} onChange={(e) => setDraft((d) => ({ ...d, ageMax: Number(e.target.value) }))} className="w-full" />
          <label className="mt-2 block text-[12px] font-extrabold">Radius (km)</label>
          <input type="range" min={5} max={100} value={draft.radiusKm} onChange={(e) => setDraft((d) => ({ ...d, radiusKm: Number(e.target.value) }))} className="w-full" />
        </FormCard>
      ) : null}

      {step === ONBOARDING_TOTAL_STEPS - 1 ? (
        <>
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3">
            <IoSparkles className="mt-0.5 shrink-0 text-amber-600" size={16} />
            <p className="text-[14px] font-semibold text-amber-900">
              Want a free 7-day Silver trial? Verify your identity after publishing — approved verification
              automatically starts your trial.
            </p>
          </div>
          <div className="linkup-card border border-border/80 bg-[#F5F6FA] p-4">
            <p className="text-[14px] font-extrabold text-foreground">Contacts import</p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
              Available on the LinkUp mobile app — import your contacts there for additional safety context when
              matching.
            </p>
          </div>
        </>
      ) : null}

      {!canContinue && continueHint ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-900">
          {continueHint}
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving || !canContinue}
        onClick={() => void handleContinue()}
        className="w-full min-h-[48px] rounded-full linkup-gradient-primary font-extrabold text-white shadow-md disabled:opacity-50"
      >
        {saving ? 'Saving…' : step < ONBOARDING_TOTAL_STEPS - 1 ? 'Continue' : 'Finish & go to Discover'}
      </button>
    </div>
  );
}
