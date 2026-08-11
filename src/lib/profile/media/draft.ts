import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import { ensurePrimaryPhoto } from '@/lib/profile/media/validation';
import type { DbProfileVideo, ProfileMediaDraft, ProfilePhotoDraftItem, ProfileVideoDraft } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';

export function defaultProfileMediaDraft(): ProfileMediaDraft {
  return { photos: [], videos: [] };
}

export function newPhotoClientId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mediaDraftFromProfile(
  profile: Pick<DbProfile, 'photo_urls' | 'primary_photo_url' | 'avatar_url'> | null,
  videos: DbProfileVideo[]
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
    videos: videos.map((v) => ({
      id: v.id,
      url: v.url,
      storagePath: v.storagePath,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
    })),
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

  const mergedVideos: ProfileVideoDraft[] = local.videos.map((localVid, i) => {
    if (localVid.localFile && !localVid.url && fromDb.videos[i]?.url) {
      return {
        ...localVid,
        id: fromDb.videos[i].id,
        url: fromDb.videos[i].url,
        storagePath: fromDb.videos[i].storagePath,
        thumbnailUrl: fromDb.videos[i].thumbnailUrl,
        durationSeconds: fromDb.videos[i].durationSeconds,
        localFile: undefined,
      };
    }
    return localVid;
  });

  return ensurePrimaryPhoto({ photos: mergedPhotos, videos: mergedVideos });
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
