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

/** Photos first; profile video slots in after the third photo when possible (dating-app style). */
export function buildHostMediaSequence(
  profile: ProfilePhotos | null | undefined,
  video: DbProfileVideo | null
): HostMediaItem[] {
  const photos = resolveGalleryPhotoUrls(profile);
  const primary = photos[0] ?? null;

  const items: HostMediaItem[] = photos.map((url, index) => ({
    kind: 'photo',
    id: `photo-${index}-${url.slice(-16)}`,
    url,
    isPrimary: url === primary && index === 0,
  }));

  if (video?.url) {
    const insertAt = Math.min(3, items.length);
    items.splice(insertAt, 0, {
      kind: 'video',
      id: `video-${video.id}`,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
    });
  }

  return items;
}
