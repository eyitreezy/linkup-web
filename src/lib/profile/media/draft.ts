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

function urlMatchesPhotoClientId(url: string, clientId: string): boolean {
  if (!url || !clientId) return false;
  try {
    const pathname = new URL(url).pathname;
    return pathname.includes(`/${clientId}.`);
  } catch {
    return url.includes(`/${clientId}.`);
  }
}

export function mergeProfileMediaDraftFromDb(
  local: ProfileMediaDraft,
  fromDb: ProfileMediaDraft
): ProfileMediaDraft {
  const usedDbPhotoUrls = new Set<string>();
  const mergedPhotos = local.photos.map((p) => {
    if (p.url || !p.localFile) return p;
    const match = fromDb.photos.find(
      (db) =>
        db.url &&
        !usedDbPhotoUrls.has(db.url) &&
        (urlMatchesPhotoClientId(db.url, p.clientId) || db.clientId === p.clientId)
    );
    if (!match?.url) return p;
    usedDbPhotoUrls.add(match.url);
    return { ...p, url: match.url, localFile: undefined };
  });

  let video = local.video;
  if (local.video === null) {
    video = null;
  } else if (local.video?.localFile && !local.video.url && fromDb.video?.url) {
    video = {
      ...local.video,
      id: fromDb.video.id,
      url: fromDb.video.url,
      storagePath: fromDb.video.storagePath,
      thumbnailUrl: fromDb.video.thumbnailUrl,
      durationSeconds: fromDb.video.durationSeconds,
      localFile: undefined,
    };
  }

  return ensurePrimaryPhoto({ photos: mergedPhotos, video });
}

export function setPrimaryPhoto(media: ProfileMediaDraft, clientId: string): ProfileMediaDraft {
  return {
    ...media,
    photos: media.photos.map((p) => ({ ...p, isPrimary: p.clientId === clientId })),
  };
}

export function removePhoto(media: ProfileMediaDraft, clientId: string): ProfileMediaDraft {
  revokePhotoPreviewUrl(clientId);
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

const photoBlobUrlCache = new Map<string, string>();

export function revokePhotoPreviewUrl(clientId: string): void {
  const cached = photoBlobUrlCache.get(clientId);
  if (cached) {
    URL.revokeObjectURL(cached);
    photoBlobUrlCache.delete(clientId);
  }
}

export function photoPreviewUrl(photo: ProfilePhotoDraftItem): string | null {
  if (photo.url) return photo.url;
  if (photo.localFile) {
    const cached = photoBlobUrlCache.get(photo.clientId);
    if (cached) return cached;
    const url = URL.createObjectURL(photo.localFile);
    photoBlobUrlCache.set(photo.clientId, url);
    return url;
  }
  return null;
}
