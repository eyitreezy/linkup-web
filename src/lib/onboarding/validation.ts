import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { ageFromBirthDate, draftFromProfile } from '@/lib/onboarding/hydrate';
import { validatePromptAnswers } from '@/lib/onboarding/promptAnswers';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { profileMediaMeetsMinimums, profileMediaValidationMessage } from '@/lib/profile/media/validation';
import type { DbProfileVideo } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';
import type { OnboardingDraft } from '@/types/onboarding';

/** Merge in-progress draft with saved profile data (same rules as finalize). */
export function mergeDraftForFinishCheck(
  draft: OnboardingDraft,
  profile: DbProfile | null,
  video: DbProfileVideo | null
): OnboardingDraft {
  const fromDb = draftFromProfile(profile, video);
  return {
    ...fromDb,
    ...draft,
    adultConfirmed: draft.adultConfirmed || fromDb.adultConfirmed,
    profileMedia: profileMediaMeetsMinimums(draft.profileMedia) ? draft.profileMedia : fromDb.profileMedia,
    locationLabel: hasValidProfileLocation(draft) ? draft.locationLabel : fromDb.locationLabel,
    locationLatitude: hasValidProfileLocation(draft) ? draft.locationLatitude : fromDb.locationLatitude,
    locationLongitude: hasValidProfileLocation(draft) ? draft.locationLongitude : fromDb.locationLongitude,
  };
}

export function getOnboardingFinishBlocker(draft: OnboardingDraft): string | null {
  if (draft.displayName.trim().length < 1) {
    return 'Add a display name on the Photos step.';
  }
  if (!draft.adultConfirmed) {
    return 'Confirm you are 18 or older on the Photos step.';
  }
  if (ageFromBirthDate(draft.birthDate) < 18) {
    return 'You must be 18 or older to use LinkUp.';
  }

  const mediaMsg = profileMediaValidationMessage(draft.profileMedia);
  if (mediaMsg) return mediaMsg;
  if (!profileMediaMeetsMinimums(draft.profileMedia)) {
    return 'Add at least 3 photos and 1 profile video on the Photos step.';
  }

  if (draft.interests.length < 1) {
    return 'Add at least one interest on the About you step.';
  }
  if (draft.languages.length < 1) {
    return 'Add at least one language on the About you step.';
  }
  if (draft.meetingIntent == null) {
    return 'Choose what you’re here for on the About you step.';
  }

  const promptErr = validatePromptAnswers(draft.promptAnswers);
  if (promptErr) return promptErr;

  if (!hasValidProfileLocation(draft)) {
    return 'Pick your location from search results on the Location step.';
  }

  return null;
}

/** Step index (0-based) where the user should go to resolve a finish blocker. */
export function getOnboardingFinishBlockerStep(draft: OnboardingDraft): number {
  if (
    draft.displayName.trim().length < 1 ||
    !draft.adultConfirmed ||
    ageFromBirthDate(draft.birthDate) < 18 ||
    profileMediaValidationMessage(draft.profileMedia) ||
    !profileMediaMeetsMinimums(draft.profileMedia)
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
