'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { ProfileMediaManager } from '@/features/profile/ProfileMediaManager';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { HINGE_PROMPTS, INTEREST_TAGS, LANGUAGE_OPTIONS, ONBOARDING_STEP_LABELS, ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { ProfilePromptEditor } from '@/components/profile/ProfilePromptEditor';
import { draftFromProfile } from '@/lib/onboarding/hydrate';
import { getOnboardingFinishBlocker, getOnboardingFinishBlockerStep, getOnboardingStepBlocker } from '@/lib/onboarding/validation';
import { autosaveOnboardingProgress, finalizeOnboarding, saveOnboardingStep } from '@/lib/onboarding/persist';
import {
  clearOnboardingSessionDraft,
  loadOnboardingSessionDraft,
  saveOnboardingSessionDraft,
} from '@/lib/onboarding/sessionDraft';
import { linkInvitationAfterSignup } from '@/lib/plans/planInvitations';
import {
  onboardingFieldClass,
  onboardingTextareaClass,
  onboardingValidationWrapClass,
} from '@/lib/onboarding/formFieldClass';
import { mediaDraftFromProfile, mergeProfileMediaDraftFromDb } from '@/lib/profile/media/draft';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileVideos, profileVideoPersistMeta } from '@/services/profileMedia.service';
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
  const [validationHighlightStep, setValidationHighlightStep] = useState<number | null>(null);
  const preferencesRef = useRef<ProfilePreferences | null>(null);
  const videoMetaRef = useRef<Array<{ id: string; storagePath: string }>>([]);
  const hydratedUserRef = useRef<string | null>(null);
  const autosaveReadyRef = useRef(false);
  const skipAutosaveOnceRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaAutosaveInFlightRef = useRef(false);
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
      const videos = await fetchProfileVideos(client, user.id);
      return { ...bundle, videos };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!data?.profile || !user?.id) return;

    preferencesRef.current = data.profile.preferences ?? null;
    videoMetaRef.current = profileVideoPersistMeta(data.videos ?? []);

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

      const fromDb = draftFromProfile(data.profile, data.videos ?? []);
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
  }, [data?.profile, data?.videos, user?.id]);

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
        existingVideos: videoMetaRef.current,
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
      draft.profileMedia.photos.some((p) => p.localFile) ||
      draft.profileMedia.videos.some((v) => v.localFile);
    const delay = hasLocalMedia ? AUTOSAVE_MEDIA_MS : AUTOSAVE_MS;

    autosaveTimerRef.current = setTimeout(() => {
      void (async () => {
        if (mediaAutosaveInFlightRef.current) return;

        const snapshot = draftRef.current;
        const snapshotStep = stepRef.current;
        const hasLocalMedia =
          snapshot.profileMedia.photos.some((p) => p.localFile) ||
          snapshot.profileMedia.videos.some((v) => v.localFile);

        if (hasLocalMedia) {
          mediaAutosaveInFlightRef.current = true;
        }

        setAutosaving(true);
        try {
          const result = await autosaveOnboardingProgress({
            userId: user.id,
            draft: snapshot,
            stepIndex: snapshotStep,
            existingPreferences: preferencesRef.current,
            existingVideos: videoMetaRef.current,
          });

          if (result.error) {
            setError(result.error);
            return;
          }

          preferencesRef.current = result.preferences;

          if (result.mediaUploaded) {
            skipAutosaveOnceRef.current = true;
            const client = createClient();
            const bundle = await fetchUserProfileBundle(client, user.id);
            const videos = await fetchProfileVideos(client, user.id);
            videoMetaRef.current = profileVideoPersistMeta(videos);
            if (bundle.profile) {
              const fromDb = mediaDraftFromProfile(bundle.profile, videos);
              setDraft((d) => ({
                ...d,
                profileMedia: mergeProfileMediaDraftFromDb(d.profileMedia, fromDb),
              }));
            }
          }
        } finally {
          mediaAutosaveInFlightRef.current = false;
          setAutosaving(false);

          const pendingLocal =
            draftRef.current.profileMedia.photos.some((p) => p.localFile) ||
            draftRef.current.profileMedia.videos.some((v) => v.localFile);
          if (pendingLocal && autosaveReadyRef.current && !onboardingFinishedRef.current && !saving) {
            skipAutosaveOnceRef.current = false;
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = setTimeout(() => {
              setDraft((d) => ({ ...d }));
            }, 120);
          }
        }
      })();
    }, delay);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, step, user?.id, saving]);

  const finishBlocker = useMemo(() => getOnboardingFinishBlocker(draft), [draft]);

  const canContinue = useMemo(() => {
    if (step === ONBOARDING_TOTAL_STEPS - 1) {
      return finishBlocker === null;
    }
    return getOnboardingStepBlocker(draft, step) === null;
  }, [step, draft, finishBlocker]);

  const continueHint = useMemo(() => {
    if (step === ONBOARDING_TOTAL_STEPS - 1) return finishBlocker;
    return getOnboardingStepBlocker(draft, step);
  }, [step, draft, finishBlocker]);

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
    setValidationHighlightStep(null);
    setStep(nextStep);
  }

  const finishBlockerStep = useMemo(() => {
    if (finishBlocker === null) return null;
    return getOnboardingFinishBlockerStep(draft);
  }, [draft, finishBlocker]);

  async function handleContinue() {
    if (!user?.id) return;

    const stepBlocker = step === ONBOARDING_TOTAL_STEPS - 1 ? finishBlocker : getOnboardingStepBlocker(draft, step);
    if (stepBlocker) {
      setError(stepBlocker);
      const redirectStep =
        step === ONBOARDING_TOTAL_STEPS - 1 ? getOnboardingFinishBlockerStep(draft) : step;
      setValidationHighlightStep(redirectStep);
      if (step === ONBOARDING_TOTAL_STEPS - 1 && redirectStep !== step) {
        goToStep(redirectStep);
      }
      return;
    }
    setSaving(true);
    setError(null);
    setValidationHighlightStep(null);
    const savedPreferences = preferencesRef.current ?? data?.profile?.preferences ?? null;

    if (step < ONBOARDING_TOTAL_STEPS - 1) {
      const { error: err } = await saveOnboardingStep({
        userId: user.id,
        draft,
        existingPreferences: savedPreferences,
        stepIndex: step,
        existingVideos: videoMetaRef.current.length
          ? videoMetaRef.current
          : profileVideoPersistMeta(data?.videos ?? []),
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
      draft: draftRef.current,
      stepIndex: step,
      existingPreferences: savedPreferences,
      existingVideos: videoMetaRef.current.length
        ? videoMetaRef.current
        : profileVideoPersistMeta(data?.videos ?? []),
    });
    if (flushResult.error) {
      autosaveReadyRef.current = true;
      setSaving(false);
      setError(flushResult.error);
      return;
    }
    preferencesRef.current = flushResult.preferences;

    let finalizeDraft = draftRef.current;

    if (flushResult.mediaUploaded) {
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const videos = await fetchProfileVideos(client, user.id);
      videoMetaRef.current = profileVideoPersistMeta(videos);
      if (bundle.profile) {
        const fromDb = mediaDraftFromProfile(bundle.profile, videos);
        finalizeDraft = {
          ...finalizeDraft,
          profileMedia: mergeProfileMediaDraftFromDb(finalizeDraft.profileMedia, fromDb),
        };
        draftRef.current = finalizeDraft;
        setDraft(finalizeDraft);
      }
    }

    saveOnboardingSessionDraft(user.id, step, maxReachedStep, finalizeDraft);

    const finalizeBlocker = getOnboardingFinishBlocker(finalizeDraft);
    if (finalizeBlocker) {
      autosaveReadyRef.current = true;
      setSaving(false);
      setError(finalizeBlocker);
      const redirectStep = getOnboardingFinishBlockerStep(finalizeDraft);
      setValidationHighlightStep(redirectStep);
      if (redirectStep !== step) goToStep(redirectStep);
      return;
    }

    const { error: err } = await finalizeOnboarding({
      userId: user.id,
      draft: finalizeDraft,
      existingPreferences: flushResult.preferences,
      existingVideos: videoMetaRef.current.length
        ? videoMetaRef.current
        : profileVideoPersistMeta(data?.videos ?? []),
    });
    setSaving(false);
    if (err) {
      autosaveReadyRef.current = true;
      setError(err);
      const redirectStep = getOnboardingFinishBlockerStep(finalizeDraft);
      setValidationHighlightStep(redirectStep);
      if (redirectStep !== step) goToStep(redirectStep);
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
          const needsAttention = validationHighlightStep === i;
          const className = cn(
            'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold min-[400px]:text-[12px]',
            active
              ? 'linkup-gradient-primary text-white shadow-sm'
              : reachable
                ? 'border border-primary/30 bg-white text-foreground hover:border-primary/50'
                : 'cursor-not-allowed border border-border bg-white/80 text-muted opacity-60',
            needsAttention && 'outline outline-2 outline-amber-400 outline-offset-0'
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
      <p
        className="text-[12px] font-semibold text-muted transition-opacity duration-200"
        style={{ opacity: autosaving ? 1 : 0 }}
        aria-live="polite"
      >
        Saving your progress…
      </p>

      {step === 0 ? (
        <FormCard className={validationHighlightStep === 0 ? 'outline outline-2 outline-amber-400 outline-offset-0' : undefined}>
          <PremiumSectionHead title="Photos & video" />
          <label className="mt-3 block text-[13px] font-extrabold">Display name</label>
          <input
            className={onboardingFieldClass}
            value={draft.displayName}
            onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
          />
          <label className="mt-4 block text-[13px] font-extrabold">Birthday</label>
          <input
            type="date"
            className={onboardingFieldClass}
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
        <div className={cn('space-y-6', onboardingValidationWrapClass(validationHighlightStep === 1))}>
          <FormCard>
            <PremiumSectionHead title="Bio" />
            <textarea
              maxLength={150}
              className={onboardingTextareaClass}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            />
          </FormCard>
          <FormCard>
            <PremiumSectionHead title="Interests & languages" />
            <div className="mt-2 min-h-[7.5rem] flex flex-wrap content-start gap-2">
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
            <div className="mt-4 min-h-[5rem] flex flex-wrap content-start gap-2">
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
            <div className="mt-2 min-h-[2.75rem] flex flex-wrap content-start gap-2">
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
        </div>
      ) : null}

      {step === 2 ? (
        <FormCard className={validationHighlightStep === 2 ? 'outline outline-2 outline-amber-400 outline-offset-0' : undefined}>
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
        <FormCard className={validationHighlightStep === 3 ? 'outline outline-2 outline-amber-400 outline-offset-0' : undefined}>
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

      <div className="min-h-[3.5rem]">
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
      </div>

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
