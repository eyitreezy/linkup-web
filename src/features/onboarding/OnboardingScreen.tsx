'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { ProfileMediaManager } from '@/features/profile/ProfileMediaManager';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { HINGE_PROMPTS, INTEREST_TAGS, LANGUAGE_OPTIONS, ONBOARDING_STEP_LABELS, ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { validatePromptAnswers } from '@/lib/onboarding/promptAnswers';
import { getOnboardingFinishBlocker, getOnboardingFinishBlockerStep, mergeDraftForFinishCheck } from '@/lib/onboarding/validation';
import { ProfilePromptEditor } from '@/components/profile/ProfilePromptEditor';
import { ageFromBirthDate, draftFromProfile } from '@/lib/onboarding/hydrate';
import { autosaveOnboardingProgress, finalizeOnboarding, saveOnboardingStep } from '@/lib/onboarding/persist';
import {
  clearOnboardingSessionDraft,
  loadOnboardingSessionDraft,
  saveOnboardingSessionDraft,
} from '@/lib/onboarding/sessionDraft';
import { linkInvitationAfterSignup } from '@/lib/plans/planInvitations';
import { mediaDraftFromProfile } from '@/lib/profile/media/draft';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { profileMediaMeetsMinimums, profileMediaValidationMessage } from '@/lib/profile/media/validation';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileVideo } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { MeetingIntent } from '@/types/onboarding';
import { defaultOnboardingDraft, preferencesFromDraft, type OnboardingDraft } from '@/types/onboarding';
import type { ProfilePreferences } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoSparkles } from 'react-icons/io5';

const INTENTS: { id: MeetingIntent; label: string }[] = [
  { id: 'friendship', label: 'Friendship' },
  { id: 'dating', label: 'Dating' },
  { id: 'activity', label: 'Activities' },
  { id: 'networking', label: 'Networking' },
];

const AUTOSAVE_MS = 900;
const AUTOSAVE_MEDIA_MS = 1800;

export function OnboardingScreen({ invitationToken }: { invitationToken?: string | null }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const invitationTokenRef = useRef(invitationToken?.trim() || null);
  const [step, setStep] = useState(0);
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preferencesRef = useRef<ProfilePreferences | null>(null);
  const videoMetaRef = useRef<{ id?: string; storagePath?: string }>({});
  const hydratedUserRef = useRef<string | null>(null);
  const autosaveReadyRef = useRef(false);
  const skipAutosaveOnceRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onboardingFinishedRef = useRef(false);
  const draftRef = useRef(draft);
  const stepRef = useRef(step);
  const maxReachedStepRef = useRef(maxReachedStep);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    maxReachedStepRef.current = maxReachedStep;
  }, [maxReachedStep]);

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
    if (!data?.profile || !user?.id) return;

    preferencesRef.current = data.profile.preferences ?? null;
    videoMetaRef.current = {
      id: data.video?.id,
      storagePath: data.video?.storagePath,
    };

    const resumeStep =
      data.profile.onboarding_status === 'pending'
        ? Math.max(
            0,
            Math.min(
              Math.floor(data.profile.preferences?.onboarding_step ?? 0),
              ONBOARDING_TOTAL_STEPS - 1
            )
          )
        : 0;

    if (hydratedUserRef.current !== user.id) {
      hydratedUserRef.current = user.id;
      skipAutosaveOnceRef.current = true;
      autosaveReadyRef.current = false;

      const fromDb = draftFromProfile(data.profile, data.video);
      const fromSession = loadOnboardingSessionDraft(user.id);
      const mergedDraft: OnboardingDraft = fromSession
        ? {
            ...fromDb,
            ...fromSession.draft,
            adultConfirmed: Boolean(fromSession.draft.adultConfirmed || fromDb.adultConfirmed),
            profileMedia: fromDb.profileMedia,
            localPhotoFiles: fromDb.localPhotoFiles,
            remotePhotoUrls: fromDb.remotePhotoUrls,
          }
        : fromDb;

      const mergedStep = fromSession
        ? Math.max(resumeStep, Math.min(fromSession.step, ONBOARDING_TOTAL_STEPS - 1))
        : resumeStep;

      const mergedMaxReached = Math.max(
        resumeStep,
        fromSession?.maxReachedStep ?? 0,
        mergedStep
      );

      setDraft(mergedDraft);
      setStep(mergedStep);
      setMaxReachedStep(mergedMaxReached);
      window.setTimeout(() => {
        autosaveReadyRef.current = true;
      }, 200);
    }
  }, [data?.profile, data?.video, user?.id]);

  useEffect(() => {
    if (!user?.id || hydratedUserRef.current !== user.id || onboardingFinishedRef.current) return;
    saveOnboardingSessionDraft(user.id, step, maxReachedStep, draft);
  }, [draft, step, maxReachedStep, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    function flushAutosave() {
      if (!autosaveReadyRef.current || saving || onboardingFinishedRef.current) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      saveOnboardingSessionDraft(userId, stepRef.current, maxReachedStepRef.current, draftRef.current);
      void autosaveOnboardingProgress({
        userId,
        draft: draftRef.current,
        stepIndex: stepRef.current,
        existingPreferences: preferencesRef.current,
        existingVideoMediaId: videoMetaRef.current.id,
        existingVideoStoragePath: videoMetaRef.current.storagePath,
      });
    }

    window.addEventListener('pagehide', flushAutosave);
    return () => window.removeEventListener('pagehide', flushAutosave);
  }, [user?.id, saving]);

  useEffect(() => {
    if (!autosaveReadyRef.current || !user?.id || saving || onboardingFinishedRef.current) return;

    if (skipAutosaveOnceRef.current) {
      skipAutosaveOnceRef.current = false;
      return;
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    const hasLocalMedia =
      draft.profileMedia.photos.some((p) => p.localFile) || Boolean(draft.profileMedia.video?.localFile);
    const delay = hasLocalMedia ? AUTOSAVE_MEDIA_MS : AUTOSAVE_MS;

    autosaveTimerRef.current = setTimeout(() => {
      void (async () => {
        setAutosaving(true);
        const result = await autosaveOnboardingProgress({
          userId: user.id,
          draft,
          stepIndex: step,
          existingPreferences: preferencesRef.current,
          existingVideoMediaId: videoMetaRef.current.id,
          existingVideoStoragePath: videoMetaRef.current.storagePath,
        });
        setAutosaving(false);

        if (result.error) {
          setError(result.error);
          return;
        }

        preferencesRef.current = result.preferences;

        if (result.mediaUploaded) {
          skipAutosaveOnceRef.current = true;
          const client = createClient();
          const bundle = await fetchUserProfileBundle(client, user.id);
          const video = await fetchProfileVideo(client, user.id);
          videoMetaRef.current = { id: video?.id, storagePath: video?.storagePath };
          if (bundle.profile) {
            setDraft((d) => ({
              ...d,
              profileMedia: mediaDraftFromProfile(bundle.profile, video),
            }));
          }
        }
      })();
    }, delay);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, step, user?.id, saving]);

  const finishDraft = useMemo(() => {
    if (!data?.profile) return draft;
    return mergeDraftForFinishCheck(draft, data.profile, data.video ?? null);
  }, [draft, data?.profile, data?.video]);

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
      return (
        draft.interests.length >= 1 &&
        draft.languages.length >= 1 &&
        draft.meetingIntent != null &&
        validatePromptAnswers(draft.promptAnswers) === null
      );
    }
    if (step === 2) return hasValidProfileLocation(draft);
    return getOnboardingFinishBlocker(finishDraft) === null;
  }, [step, draft, finishDraft]);

  const continueHint = useMemo(() => {
    if (step === 0) {
      if (!draft.adultConfirmed) return 'Confirm you are 18+ to continue.';
      return profileMediaValidationMessage(draft.profileMedia);
    }
    if (step === 1) return validatePromptAnswers(draft.promptAnswers) ?? 'Add interests, languages, intent, and at least one prompt.';
    if (step === 2) return 'Pick your location from search results.';
    return getOnboardingFinishBlocker(finishDraft);
  }, [step, draft, finishDraft]);

  useEffect(() => {
    if (invitationToken?.trim()) {
      invitationTokenRef.current = invitationToken.trim();
    }
  }, [invitationToken]);

  async function routeAfterOnboarding() {
    const token = invitationTokenRef.current;
    if (token) {
      try {
        const linked = await linkInvitationAfterSignup(token);
        if (linked.linked && linked.planId && linked.invitationId) {
          router.replace(`/plan/${linked.planId}/invitation/${linked.invitationId}`);
          router.refresh();
          return;
        }
      } catch {
        /* fall through */
      }
    }
    router.replace('/discover');
    router.refresh();
    window.setTimeout(() => {
      if (window.location.pathname.startsWith('/onboarding')) {
        window.location.assign('/discover');
      }
    }, 400);
  }

  function goToStep(nextStep: number) {
    if (nextStep > maxReachedStep || nextStep < 0 || nextStep >= ONBOARDING_TOTAL_STEPS) return;
    skipAutosaveOnceRef.current = true;
    setStep(nextStep);
  }

  const finishBlockerStep = useMemo(() => {
    if (step !== ONBOARDING_TOTAL_STEPS - 1) return null;
    if (getOnboardingFinishBlocker(finishDraft) === null) return null;
    return getOnboardingFinishBlockerStep(finishDraft);
  }, [step, finishDraft]);

  async function handleContinue() {
    if (!user?.id) return;

    if (!canContinue) {
      const blocker = step === ONBOARDING_TOTAL_STEPS - 1 ? getOnboardingFinishBlocker(finishDraft) : continueHint;
      if (blocker) setError(blocker);
      return;
    }
    setSaving(true);
    setError(null);
    const savedPreferences = preferencesRef.current ?? data?.profile?.preferences ?? null;

    if (step < ONBOARDING_TOTAL_STEPS - 1) {
      const { error: err } = await saveOnboardingStep({
        userId: user.id,
        draft,
        existingPreferences: savedPreferences,
        stepIndex: step,
        existingVideoMediaId: videoMetaRef.current.id ?? data?.video?.id,
        existingVideoStoragePath: videoMetaRef.current.storagePath ?? data?.video?.storagePath,
      });
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
      preferencesRef.current = {
        ...(savedPreferences ?? {}),
        ...preferencesFromDraft(draft),
        adult_confirmed: draft.adultConfirmed,
        onboarding_step: Math.min(step + 1, ONBOARDING_TOTAL_STEPS - 1),
      };
      skipAutosaveOnceRef.current = true;
      const nextStep = step + 1;
      setMaxReachedStep((m) => Math.max(m, nextStep));
      setStep(nextStep);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-bundle'] });
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autosaveReadyRef.current = false;

    const flushResult = await autosaveOnboardingProgress({
      userId: user.id,
      draft,
      stepIndex: step,
      existingPreferences: savedPreferences,
      existingVideoMediaId: videoMetaRef.current.id ?? data?.video?.id,
      existingVideoStoragePath: videoMetaRef.current.storagePath ?? data?.video?.storagePath,
    });
    if (flushResult.error) {
      autosaveReadyRef.current = true;
      setSaving(false);
      setError(flushResult.error);
      return;
    }
    preferencesRef.current = flushResult.preferences;

    let draftForFinalize = finishDraft;
    if (flushResult.mediaUploaded) {
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const video = await fetchProfileVideo(client, user.id);
      videoMetaRef.current = { id: video?.id, storagePath: video?.storagePath };
      if (bundle.profile) {
        const refreshedMedia = mediaDraftFromProfile(bundle.profile, video);
        draftForFinalize = mergeDraftForFinishCheck(
          { ...draft, profileMedia: refreshedMedia },
          bundle.profile,
          video
        );
        setDraft((d) => ({
          ...d,
          profileMedia: refreshedMedia,
        }));
      }
    }

    saveOnboardingSessionDraft(user.id, step, maxReachedStep, draftForFinalize);

    const { error: err } = await finalizeOnboarding({
      userId: user.id,
      draft: draftForFinalize,
      existingPreferences: flushResult.preferences,
      existingVideoMediaId: videoMetaRef.current.id ?? data?.video?.id,
      existingVideoStoragePath: videoMetaRef.current.storagePath ?? data?.video?.storagePath,
    });
    setSaving(false);
    if (err) {
      autosaveReadyRef.current = true;
      setError(err);
      return;
    }

    onboardingFinishedRef.current = true;
    clearOnboardingSessionDraft();
    await queryClient.invalidateQueries({ queryKey: ['onboarding-bundle'] });
    await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
    await routeAfterOnboarding();
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
        subtitle="Photos, video, and basics with the same quality bar as the LinkUp app."
        showBack={false}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ONBOARDING_STEP_LABELS.map((label, i) => {
          const active = i === step;
          const reachable = i <= maxReachedStep;
          const className = cn(
            'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold min-[400px]:text-[12px]',
            active
              ? 'linkup-gradient-primary text-white shadow-sm'
              : reachable
                ? 'border border-primary/30 bg-white text-foreground hover:border-primary/50'
                : 'cursor-not-allowed border border-border bg-white/80 text-muted opacity-60'
          );

          if (!reachable) {
            return (
              <span key={label} className={className} aria-disabled="true">
                {i + 1}. {label}
              </span>
            );
          }

          return (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(i)}
              className={className}
              aria-current={active ? 'step' : undefined}
            >
              {i + 1}. {label}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-[14px] font-extrabold text-red-600">{error}</p> : null}
      {autosaving ? (
        <p className="text-[12px] font-semibold text-muted">Saving your progress…</p>
      ) : null}

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
            <ProfilePromptEditor
              answers={draft.promptAnswers}
              onChange={(promptAnswers) => setDraft((d) => ({ ...d, promptAnswers }))}
              showValidation
            />
          </FormCard>
        </>
      ) : null}

      {step === 2 ? (
        <FormCard>
          <PremiumSectionHead title="Location" />
          <LocationSearchField
            value={draft.locationLabel}
            onChange={(label) =>
              setDraft((d) => ({
                ...d,
                locationLabel: label,
                locationLatitude: null,
                locationLongitude: null,
              }))
            }
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
            Age {draft.ageMin} to {draft.ageMax}, radius {draft.radiusKm} km
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
              Want a free 7-day Silver trial? Verify your identity after publishing. Approved verification
              automatically starts your trial.
            </p>
          </div>
          <div className="linkup-card border border-border/80 bg-[#F5F6FA] p-4">
            <p className="text-[14px] font-extrabold text-foreground">Contacts import</p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
              Available on the LinkUp mobile app. Import your contacts there for additional safety context when
              matching.
            </p>
          </div>
        </>
      ) : null}

      {!canContinue && continueHint ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-amber-900">{continueHint}</p>
          {finishBlockerStep != null && finishBlockerStep !== step ? (
            <button
              type="button"
              onClick={() => goToStep(finishBlockerStep)}
              className="mt-2 text-[13px] font-extrabold text-primary underline hover:no-underline"
            >
              Go to step {finishBlockerStep + 1}: {ONBOARDING_STEP_LABELS[finishBlockerStep]}
            </button>
          ) : null}
        </div>
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
