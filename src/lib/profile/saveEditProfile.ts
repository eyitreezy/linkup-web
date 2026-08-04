import { ageFromBirthDate } from '@/lib/onboarding/hydrate';
import { validatePromptAnswers } from '@/lib/onboarding/promptAnswers';
import { persistProfileMediaDraft } from '@/lib/profile/media/persist';
import {
  activePhotoCount,
  hasProfileVideo,
  profileMediaMeetsMinimums,
  profileMediaValidationMessage,
} from '@/lib/profile/media/validation';
import { hasValidProfileLocation, profileLocationFromDraft } from '@/lib/profile/profileLocation';
import { createClient } from '@/lib/supabase/client';
import type { ProfilePreferences } from '@/types/database';
import { preferencesFromDraft, type OnboardingDraft } from '@/types/onboarding';

function birthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function saveEditProfile(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
  existingVideoMediaId?: string;
  existingVideoStoragePath?: string;
  /** When false, allow saving with fewer than 3 photos / no video (legacy edit). Onboarding requires true. */
  requireFullMedia?: boolean;
}): Promise<{ error: string | null }> {
  const { userId, draft, existingPreferences, requireFullMedia = false } = args;
  const age = ageFromBirthDate(draft.birthDate);
  if (age < 18) return { error: 'You must be 18 or older.' };
  if (!draft.displayName.trim()) return { error: 'Add a display name.' };

  const photoCount = activePhotoCount(draft.profileMedia);
  if (photoCount < 1) return { error: 'Add at least one photo.' };
  if (requireFullMedia) {
    const msg = profileMediaValidationMessage(draft.profileMedia);
    if (msg) return { error: msg };
    if (!profileMediaMeetsMinimums(draft.profileMedia)) {
      return { error: profileMediaValidationMessage(draft.profileMedia) ?? 'Complete your profile media.' };
    }
  }

  if (!hasValidProfileLocation(draft)) {
    return { error: 'Add your location. Pick from search.' };
  }
  if (draft.interests.length < 1 || draft.languages.length < 1) {
    return { error: 'Pick at least one interest and one language.' };
  }
  if (!draft.meetingIntent) return { error: 'Choose what you are here for.' };

  const promptError = validatePromptAnswers(draft.promptAnswers);
  if (promptError) return { error: promptError };

  let mediaPatch: {
    photo_urls: string[];
    primary_photo_url: string | null;
    avatar_url: string | null;
  };
  try {
    const persisted = await persistProfileMediaDraft({
      userId,
      media: draft.profileMedia,
      existingVideoMediaId: args.existingVideoMediaId,
      existingVideoStoragePath: args.existingVideoStoragePath,
    });
    mediaPatch = persisted;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Media upload failed' };
  }

  const mergedPrefs: ProfilePreferences = {
    ...(existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
    adult_confirmed: draft.adultConfirmed || existingPreferences?.adult_confirmed === true,
  };

  const client = createClient();
  const { error } = await client
    .from('profiles')
    .update({
      display_name: draft.displayName.trim(),
      bio: draft.bio.trim() || null,
      birth_date: birthIso(draft.birthDate),
      gender: draft.selfGender,
      photo_urls: mediaPatch.photo_urls,
      primary_photo_url: mediaPatch.primary_photo_url,
      avatar_url: mediaPatch.avatar_url,
      age_min: draft.ageMin,
      age_max: draft.ageMax,
      radius_km: draft.radiusKm,
      is_profile_public: draft.profilePublic,
      ...profileLocationFromDraft(draft),
      preferences: mergedPrefs,
    })
    .eq('user_id', userId);

  return { error: error?.message ?? null };
}

/** Lightweight check used by onboarding continue button. */
export function draftMediaReady(draft: OnboardingDraft): boolean {
  return profileMediaMeetsMinimums(draft.profileMedia);
}

export function draftMediaValidationHint(draft: OnboardingDraft): string | null {
  return profileMediaValidationMessage(draft.profileMedia);
}
