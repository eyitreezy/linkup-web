import {
  PROFILE_MEDIA_MAX_PHOTOS,
  PROFILE_MEDIA_MAX_VIDEOS,
  PROFILE_MEDIA_MIN_PHOTOS,
  PROFILE_MEDIA_MIN_VIDEOS,
} from '@/lib/profile/media/constants';
import type { ProfileMediaDraft } from '@/lib/profile/media/types';

export function activePhotoCount(media: ProfileMediaDraft): number {
  return media.photos.filter((p) => p.url || p.localFile).length;
}

export function hasProfileVideo(media: ProfileMediaDraft): boolean {
  return (
    media.videos.length > 0 &&
    (!!media.videos[0]?.url || !!media.videos[0]?.localFile)
  );
}

export function profileMediaMeetsMinimums(media: ProfileMediaDraft): boolean {
  const photoOk = activePhotoCount(media) >= PROFILE_MEDIA_MIN_PHOTOS;
  const videoOk = media.videos.some((v) => v.url || v.localFile);
  return photoOk && videoOk;
}

export function profileMediaValidationMessage(media: ProfileMediaDraft): string | null {
  const photos = activePhotoCount(media);
  const video = hasProfileVideo(media);
  if (photos < PROFILE_MEDIA_MIN_PHOTOS && !video) {
    return `Add at least ${PROFILE_MEDIA_MIN_PHOTOS} photos and ${PROFILE_MEDIA_MIN_VIDEOS} profile video to continue.`;
  }
  if (photos < PROFILE_MEDIA_MIN_PHOTOS) {
    return `Add at least ${PROFILE_MEDIA_MIN_PHOTOS} profile photos (${photos}/${PROFILE_MEDIA_MIN_PHOTOS}).`;
  }
  if (!video) {
    return `Add ${PROFILE_MEDIA_MIN_VIDEOS} profile video. A short clip helps hosts and guests trust who you are.`;
  }
  if (photos > PROFILE_MEDIA_MAX_PHOTOS) {
    return `You can keep up to ${PROFILE_MEDIA_MAX_PHOTOS} photos.`;
  }
  if (media.videos.some((v) => v.localFile && v.id)) {
    return null;
  }
  if (media.videos.length > PROFILE_MEDIA_MAX_VIDEOS) {
    return `You can keep up to ${PROFILE_MEDIA_MAX_VIDEOS} profile videos.`;
  }
  return null;
}

export function ensurePrimaryPhoto(media: ProfileMediaDraft): ProfileMediaDraft {
  const photos = [...media.photos];
  const active = photos.filter((p) => p.url || p.localFile);
  if (active.length === 0) return { ...media, photos };
  const hasPrimary = active.some((p) => p.isPrimary);
  if (hasPrimary) return media;
  const firstActiveId = active[0].clientId;
  return {
    ...media,
    photos: photos.map((p) => ({ ...p, isPrimary: p.clientId === firstActiveId })),
  };
}
