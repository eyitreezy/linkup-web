import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { ageFromBirthDate } from '@/lib/onboarding/hydrate';
import { validatePromptAnswers } from '@/lib/onboarding/promptAnswers';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import {
  hasProfileVideo,
  profileMediaMeetsMinimums,
  profileMediaValidationMessage,
  activePhotoCount,
} from '@/lib/profile/media/validation';
import { PROFILE_MEDIA_MIN_PHOTOS } from '@/lib/profile/media/constants';
import type { OnboardingDraft } from '@/types/onboarding';

/** Strict validation against the current in-memory draft only — no DB fallbacks. */
export function getOnboardingFinishBlocker(draft: OnboardingDraft): string | null {
  if (draft.displayName.trim().length < 1) {
    return 'Add a display name before completing onboarding.';
  }
  if (!draft.adultConfirmed) {
    return 'Confirm you are 18 or older before completing onboarding.';
  }
  if (ageFromBirthDate(draft.birthDate) < 18) {
    return 'You must be 18 or older to use LinkUp.';
  }

  const mediaMsg = profileMediaValidationMessage(draft.profileMedia);
  if (mediaMsg) return mediaMsg;
  if (!profileMediaMeetsMinimums(draft.profileMedia)) {
    return 'You need at least 3 profile photos and 1 profile video before completing onboarding.';
  }

  if (draft.interests.length < 1) {
    return 'Add at least one interest before completing onboarding.';
  }
  if (draft.languages.length < 1) {
    return 'Add at least one language before completing onboarding.';
  }
  if (draft.meetingIntent == null) {
    return 'Choose what you’re here for before completing onboarding.';
  }

  const promptErr = validatePromptAnswers(draft.promptAnswers);
  if (promptErr) return promptErr;

  if (!hasValidProfileLocation(draft)) {
    return 'Pick your location from search results before completing onboarding.';
  }

  return null;
}

/** Step index (0-based) for the first failing requirement. */
export function getOnboardingFinishBlockerStep(draft: OnboardingDraft): number {
  if (
    draft.displayName.trim().length < 1 ||
    !draft.adultConfirmed ||
    ageFromBirthDate(draft.birthDate) < 18 ||
    activePhotoCount(draft.profileMedia) < PROFILE_MEDIA_MIN_PHOTOS ||
    !hasProfileVideo(draft.profileMedia) ||
    profileMediaValidationMessage(draft.profileMedia)
  ) {
    return 0;
  }

  if (
    draft.interests.length < 1 ||
    draft.languages.length < 1 ||
    draft.meetingIntent == null ||
    validatePromptAnswers(draft.promptAnswers)
  ) {
    return 1;
  }

  if (!hasValidProfileLocation(draft)) {
    return 2;
  }

  return ONBOARDING_TOTAL_STEPS - 1;
}

export function getOnboardingStepBlocker(draft: OnboardingDraft, stepIndex: number): string | null {
  if (stepIndex === 0) {
    if (draft.displayName.trim().length < 1) return 'Add a display name to continue.';
    if (!draft.adultConfirmed) return 'Confirm you are 18+ to continue.';
    if (ageFromBirthDate(draft.birthDate) < 18) return 'You must be 18 or older.';
    if (activePhotoCount(draft.profileMedia) < PROFILE_MEDIA_MIN_PHOTOS) {
      return `Add at least ${PROFILE_MEDIA_MIN_PHOTOS} profile photos (${activePhotoCount(draft.profileMedia)}/${PROFILE_MEDIA_MIN_PHOTOS}).`;
    }
    if (!hasProfileVideo(draft.profileMedia)) {
      return profileMediaValidationMessage(draft.profileMedia) ?? 'Add 1 profile video to continue.';
    }
    const mediaMsg = profileMediaValidationMessage(draft.profileMedia);
    if (mediaMsg) return mediaMsg;
    return null;
  }

  if (stepIndex === 1) {
    if (draft.interests.length < 1) return 'Add at least one interest to continue.';
    if (draft.languages.length < 1) return 'Add at least one language to continue.';
    if (draft.meetingIntent == null) return 'Choose what you’re here for to continue.';
    return validatePromptAnswers(draft.promptAnswers);
  }

  if (stepIndex === 2) {
    if (!hasValidProfileLocation(draft)) return 'Pick your location from search results.';
    return null;
  }

  return getOnboardingFinishBlocker(draft);
}
