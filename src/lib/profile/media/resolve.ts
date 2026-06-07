import type { DbProfile } from '@/types/database';
import type { DbProfileVideo } from '@/lib/profile/media/types';

/** Primary display photo — prefers explicit primary, then legacy first gallery slot. */
export function resolvePrimaryPhotoUrl(profile: Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'> | null | undefined): string | null {
  if (!profile) return null;
  const primary = profile.primary_photo_url?.trim();
  if (primary) return primary;
  const first = profile.photo_urls?.[0]?.trim();
  if (first) return first;
  return profile.avatar_url?.trim() ?? null;
}

/** Gallery order: primary first, then remaining photos (no duplicates). */
export function resolveGalleryPhotoUrls(profile: Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'> | null | undefined): string[] {
  if (!profile) return [];
  const raw = (profile.photo_urls ?? []).filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  const primary = resolvePrimaryPhotoUrl(profile);
  if (!primary) return raw;
  const rest = raw.filter((u) => u !== primary);
  return [primary, ...rest];
}

/** Remaining photos after primary. */
export function resolveSecondaryPhotoUrls(profile: Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'> | null | undefined): string[] {
  const gallery = resolveGalleryPhotoUrls(profile);
  if (gallery.length <= 1) return [];
  return gallery.slice(1);
}

export function profileVideoPublicUrl(storageBucket: string, storagePath: string): string {
  // Caller should use supabase getPublicUrl; this is a fallback shape for typed consumers.
  void storageBucket;
  return storagePath;
}

export function formatVideoDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type ProfileMediaBundle = {
  primaryPhotoUrl: string | null;
  galleryPhotoUrls: string[];
  secondaryPhotoUrls: string[];
  video: DbProfileVideo | null;
};

export function bundleProfileMedia(
  profile: Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'> | null | undefined,
  video: DbProfileVideo | null
): ProfileMediaBundle {
  return {
    primaryPhotoUrl: resolvePrimaryPhotoUrl(profile),
    galleryPhotoUrls: resolveGalleryPhotoUrls(profile),
    secondaryPhotoUrls: resolveSecondaryPhotoUrls(profile),
    video,
  };
}
