import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import { ensurePrimaryPhoto } from '@/lib/profile/media/validation';
import type { DbProfileVideo, ProfileMediaDraft, ProfilePhotoDraftItem } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';

export function defaultProfileMediaDraft(): ProfileMediaDraft {
  return { photos: [], video: null };
}

export function newPhotoClientId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mediaDraftFromProfile(
  profile: Pick<DbProfile, 'photo_urls' | 'primary_photo_url' | 'avatar_url'> | null,
  video: DbProfileVideo | null
): ProfileMediaDraft {
  const primary = resolvePrimaryPhotoUrl(profile);
  const urls = (profile?.photo_urls ?? []).filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  const ordered = primary ? [primary, ...urls.filter((u) => u !== primary)] : urls;

  const photos: ProfilePhotoDraftItem[] = ordered.map((url, i) => ({
    clientId: `remote-${i}-${url.slice(-12)}`,
    url,
    isPrimary: url === primary,
  }));

  return ensurePrimaryPhoto({
    photos,
    video: video
      ? {
          id: video.id,
          url: video.url,
          storagePath: video.storagePath,
          thumbnailUrl: video.thumbnailUrl,
          durationSeconds: video.durationSeconds,
        }
      : null,
  });
}

export function setPrimaryPhoto(media: ProfileMediaDraft, clientId: string): ProfileMediaDraft {
  return {
    ...media,
    photos: media.photos.map((p) => ({ ...p, isPrimary: p.clientId === clientId })),
  };
}

export function removePhoto(media: ProfileMediaDraft, clientId: string): ProfileMediaDraft {
  const photos = media.photos.filter((p) => p.clientId !== clientId);
  return ensurePrimaryPhoto({ ...media, photos });
}

export function addLocalPhotos(media: ProfileMediaDraft, files: File[]): ProfileMediaDraft {
  const next: ProfilePhotoDraftItem[] = files.map((file) => ({
    clientId: newPhotoClientId(),
    url: null,
    localFile: file,
    isPrimary: false,
  }));
  return ensurePrimaryPhoto({ ...media, photos: [...media.photos, ...next] });
}

export function photoPreviewUrl(photo: ProfilePhotoDraftItem): string | null {
  if (photo.url) return photo.url;
  if (photo.localFile) return URL.createObjectURL(photo.localFile);
  return null;
}
