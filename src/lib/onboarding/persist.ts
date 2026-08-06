import { hasValidProfileLocation, profileLocationFromDraft } from '@/lib/profile/profileLocation';
import { persistProfileMediaDraft } from '@/lib/profile/media/persist';
import { profileMediaMeetsMinimums, profileMediaValidationMessage } from '@/lib/profile/media/validation';
import { draftFromProfile } from '@/lib/onboarding/hydrate';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileVideo } from '@/services/profileMedia.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import type { DbProfile } from '@/types/database';
import type { ProfilePreferences } from '@/types/database';
import { preferencesFromDraft, type OnboardingDraft } from '@/types/onboarding';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { getOnboardingFinishBlocker } from '@/lib/onboarding/validation';
import { markSoftKycPromptPending } from '@/lib/verification/softPromptStorage';

function birthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mergedPreferences(
  draft: OnboardingDraft,
  existingPreferences: ProfilePreferences | null,
  stepIndex: number
): ProfilePreferences {
  return {
    ...(existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
    adult_confirmed: draft.adultConfirmed,
    onboarding_step: Math.max(0, Math.min(stepIndex, ONBOARDING_TOTAL_STEPS - 1)),
  };
}

function draftNeedsMediaUpload(draft: OnboardingDraft): boolean {
  if (!profileMediaMeetsMinimums(draft.profileMedia)) return false;
  const hasLocalPhoto = draft.profileMedia.photos.some((p) => p.localFile);
  const hasLocalVideo = Boolean(draft.profileMedia.video?.localFile);
  return hasLocalPhoto || hasLocalVideo;
}

/** Debounced progress save — keeps onboarding data across refresh without requiring Continue. */
export async function autosaveOnboardingProgress(args: {
  userId: string;
  draft: OnboardingDraft;
  stepIndex: number;
  existingPreferences: ProfilePreferences | null;
  existingVideoMediaId?: string;
  existingVideoStoragePath?: string;
}): Promise<{ error: string | null; preferences: ProfilePreferences; mediaUploaded: boolean }> {
  const { userId, draft, stepIndex, existingPreferences } = args;
  const client = createClient();

  const existing = await fetchUserProfileBundle(client, userId);
  if (existing.profile?.onboarding_status === 'complete') {
    return {
      error: null,
      preferences: existing.profile.preferences ?? existingPreferences ?? mergedPreferences(draft, existingPreferences, stepIndex),
      mediaUploaded: false,
    };
  }

  const mergedPrefs = mergedPreferences(draft, existingPreferences, stepIndex);

  const patch: Record<string, unknown> = {
    display_name: draft.displayName.trim() || null,
    preferences: mergedPrefs,
    onboarding_status: 'pending',
  };

  patch.birth_date = birthIso(draft.birthDate);
  patch.bio = draft.bio.trim() || null;

  if (draft.selfGender) {
    patch.gender = draft.selfGender;
  }

  if (hasValidProfileLocation(draft)) {
    Object.assign(patch, profileLocationFromDraft(draft));
  }

  if (stepIndex >= 3) {
    patch.age_min = draft.ageMin;
    patch.age_max = draft.ageMax;
    patch.radius_km = draft.radiusKm;
    patch.is_profile_public = draft.profilePublic;
  }

  let mediaUploaded = false;
  if (draftNeedsMediaUpload(draft)) {
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
      mediaUploaded = true;
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Media upload failed',
        preferences: mergedPrefs,
        mediaUploaded: false,
      };
    }
  }

  const { error } = await client.from('profiles').update(patch).eq('user_id', userId);
  return {
    error: error?.message ?? null,
    preferences: mergedPrefs,
    mediaUploaded,
  };
}

export async function persistOnboardingResumeStep(args: {
  userId: string;
  stepIndex: number;
  existingPreferences: ProfilePreferences | null;
  preferencePatch?: ProfilePreferences;
}): Promise<{ error: string | null }> {
  const clamped = Math.max(0, Math.min(args.stepIndex, ONBOARDING_TOTAL_STEPS - 1));
  const merged: ProfilePreferences = {
    ...(args.existingPreferences ?? {}),
    ...(args.preferencePatch ?? {}),
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

async function resolveDraftForFinalize(
  userId: string,
  draft: OnboardingDraft
): Promise<{ draft: OnboardingDraft; error: string | null }> {
  const client = createClient();
  const bundle = await fetchUserProfileBundle(client, userId);
  const video = await fetchProfileVideo(client, userId);
  const fromDb = draftFromProfile(bundle.profile, video);

  const merged: OnboardingDraft = {
    ...fromDb,
    ...draft,
    adultConfirmed: draft.adultConfirmed || fromDb.adultConfirmed,
    profileMedia: profileMediaMeetsMinimums(draft.profileMedia) ? draft.profileMedia : fromDb.profileMedia,
    locationLabel: hasValidProfileLocation(draft) ? draft.locationLabel : fromDb.locationLabel,
    locationLatitude: hasValidProfileLocation(draft) ? draft.locationLatitude : fromDb.locationLatitude,
    locationLongitude: hasValidProfileLocation(draft) ? draft.locationLongitude : fromDb.locationLongitude,
  };

  const blocker = getOnboardingFinishBlocker(merged);
  if (blocker) return { draft: merged, error: blocker };

  return { draft: merged, error: null };
}

export async function finalizeOnboarding(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
  existingVideoMediaId?: string;
  existingVideoStoragePath?: string;
}): Promise<{ error: string | null }> {
  const resolved = await resolveDraftForFinalize(args.userId, args.draft);
  if (resolved.error) return { error: resolved.error };

  const draft = resolved.draft;
  const client = createClient();
  let mediaPatch: { photo_urls: string[]; primary_photo_url: string | null; avatar_url: string | null };

  try {
    mediaPatch = await persistProfileMediaDraft({
      userId: args.userId,
      media: draft.profileMedia,
      existingVideoMediaId: args.existingVideoMediaId,
      existingVideoStoragePath: args.existingVideoStoragePath,
    });
  } catch (e) {
    const bundle = await fetchUserProfileBundle(client, args.userId);
    const profile = bundle.profile as DbProfile | null;
    const fallbackVideo = await fetchProfileVideo(client, args.userId);
    const dbMedia = draftFromProfile(profile, fallbackVideo).profileMedia;
    if (profile?.photo_urls?.length && profileMediaMeetsMinimums(dbMedia)) {
      mediaPatch = {
        photo_urls: profile.photo_urls ?? [],
        primary_photo_url: profile.primary_photo_url ?? profile.avatar_url ?? null,
        avatar_url: profile.avatar_url ?? profile.primary_photo_url ?? null,
      };
    } else {
      return { error: e instanceof Error ? e.message : 'Media upload failed' };
    }
  }

  const mergedPrefs: ProfilePreferences = {
    ...(args.existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
    adult_confirmed: draft.adultConfirmed,
  };
  delete (mergedPrefs as ProfilePreferences & { onboarding_step?: number }).onboarding_step;

  const { error, data } = await client
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
      onboarding_status: 'complete',
      ...profileLocationFromDraft(draft),
      preferences: mergedPrefs,
    })
    .eq('user_id', args.userId)
    .select('onboarding_status')
    .single();

  if (error) return { error: error.message };
  if (data?.onboarding_status !== 'complete') {
    return { error: 'Could not complete onboarding. Try again.' };
  }

  await markSoftKycPromptPending();
  return { error: null };
}
