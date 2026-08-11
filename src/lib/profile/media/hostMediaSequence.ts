import { resolveGalleryPhotoUrls } from '@/lib/profile/media/resolve';
import type { DbProfileVideo } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';

export type HostMediaItem =
  | { kind: 'photo'; id: string; url: string; isPrimary: boolean }
  | {
      kind: 'video';
      id: string;
      url: string;
      thumbnailUrl: string | null;
      durationSeconds: number | null;
    };

type ProfilePhotos = Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'>;

/** Photos first; profile videos slot in after the third photo when possible (dating-app style). */
export function buildHostMediaSequence(
  profile: ProfilePhotos | null | undefined,
  videos: DbProfileVideo[]
): HostMediaItem[] {
  const photos = resolveGalleryPhotoUrls(profile);
  const primary = photos[0] ?? null;

  const items: HostMediaItem[] = photos.map((url, index) => ({
    kind: 'photo',
    id: `photo-${index}-${url.slice(-16)}`,
    url,
    isPrimary: url === primary && index === 0,
  }));

  const playableVideos = videos.filter((v) => v.url);
  if (playableVideos.length > 0) {
    const insertAt = Math.min(3, items.length);
    const videoItems: HostMediaItem[] = playableVideos.map((video) => ({
      kind: 'video',
      id: `video-${video.id}`,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
    }));
    items.splice(insertAt, 0, ...videoItems);
  }

  return items;
}
