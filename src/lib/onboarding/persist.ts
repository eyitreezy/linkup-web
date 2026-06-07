import { hasValidProfileLocation, profileLocationFromDraft } from '@/lib/profile/profileLocation';
import { persistProfileMediaDraft } from '@/lib/profile/media/persist';
import { profileMediaMeetsMinimums, profileMediaValidationMessage } from '@/lib/profile/media/validation';
import { createClient } from '@/lib/supabase/client';
import type { ProfilePreferences } from '@/types/database';
import { preferencesFromDraft, type OnboardingDraft } from '@/types/onboarding';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';

function birthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function persistOnboardingResumeStep(args: {
  userId: string;
  stepIndex: number;
  existingPreferences: ProfilePreferences | null;
}): Promise<{ error: string | null }> {
  const clamped = Math.max(0, Math.min(args.stepIndex, ONBOARDING_TOTAL_STEPS - 1));
  const merged: ProfilePreferences = {
    ...(args.existingPreferences ?? {}),
    onboarding_step: clamped,
  };
  const client = createClient();
  const { error } = await client.from('profiles').update({ preferences: merged }).eq('user_id', args.userId);
  return { error: error?.message ?? null };
}

export async function saveOnboardingStep(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
  stepIndex: number;
  existingVideoMediaId?: string;
  existingVideoStoragePath?: string;
}): Promise<{ error: string | null }> {
  const { userId, draft, existingPreferences, stepIndex } = args;
  const client = createClient();
  const mergedPrefs: ProfilePreferences = {
    ...(existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
    adult_confirmed: draft.adultConfirmed,
    onboarding_step: Math.min(stepIndex + 1, ONBOARDING_TOTAL_STEPS - 1),
  };

  const patch: Record<string, unknown> = {
    display_name: draft.displayName.trim() || null,
    preferences: mergedPrefs,
    onboarding_status: 'pending',
  };

  if (stepIndex === 0) {
    if (!draft.adultConfirmed) return { error: 'Confirm you are 18 or older to continue.' };
    const msg = profileMediaValidationMessage(draft.profileMedia);
    if (msg) return { error: msg };
    if (!profileMediaMeetsMinimums(draft.profileMedia)) {
      return { error: msg ?? 'Add at least 3 photos and 1 profile video.' };
    }
    try {
      const media = await persistProfileMediaDraft({
        userId,
        media: draft.profileMedia,
        existingVideoMediaId: args.existingVideoMediaId,
        existingVideoStoragePath: args.existingVideoStoragePath,
      });
      patch.photo_urls = media.photo_urls;
      patch.primary_photo_url = media.primary_photo_url;
      patch.avatar_url = media.avatar_url;
      patch.birth_date = birthIso(draft.birthDate);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Media upload failed' };
    }
  }

  if (stepIndex >= 1) {
    patch.bio = draft.bio.trim() || null;
    patch.gender = draft.selfGender;
  }

  if (stepIndex >= 2 && hasValidProfileLocation(draft)) {
    Object.assign(patch, profileLocationFromDraft(draft));
  }

  if (stepIndex >= 3) {
    patch.age_min = draft.ageMin;
    patch.age_max = draft.ageMax;
    patch.radius_km = draft.radiusKm;
    patch.is_profile_public = draft.profilePublic;
  }

  const { error } = await client.from('profiles').update(patch).eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function finalizeOnboarding(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
  existingVideoMediaId?: string;
  existingVideoStoragePath?: string;
}): Promise<{ error: string | null }> {
  const msg = profileMediaValidationMessage(args.draft.profileMedia);
  if (msg) return { error: msg };

  const client = createClient();
  let mediaPatch: { photo_urls: string[]; primary_photo_url: string | null; avatar_url: string | null };
  try {
    mediaPatch = await persistProfileMediaDraft({
      userId: args.userId,
      media: args.draft.profileMedia,
      existingVideoMediaId: args.existingVideoMediaId,
      existingVideoStoragePath: args.existingVideoStoragePath,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Media upload failed' };
  }

  const mergedPrefs: ProfilePreferences = {
    ...(args.existingPreferences ?? {}),
    ...preferencesFromDraft(args.draft),
    adult_confirmed: args.draft.adultConfirmed,
  };
  delete (mergedPrefs as ProfilePreferences & { onboarding_step?: number }).onboarding_step;

  const { error } = await client
    .from('profiles')
    .update({
      display_name: args.draft.displayName.trim(),
      bio: args.draft.bio.trim() || null,
      birth_date: birthIso(args.draft.birthDate),
      gender: args.draft.selfGender,
      photo_urls: mediaPatch.photo_urls,
      primary_photo_url: mediaPatch.primary_photo_url,
      avatar_url: mediaPatch.avatar_url,
      age_min: args.draft.ageMin,
      age_max: args.draft.ageMax,
      radius_km: args.draft.radiusKm,
      is_profile_public: args.draft.profilePublic,
      onboarding_status: 'complete',
      ...profileLocationFromDraft(args.draft),
      preferences: mergedPrefs,
    })
    .eq('user_id', args.userId);

  return { error: error?.message ?? null };
}
