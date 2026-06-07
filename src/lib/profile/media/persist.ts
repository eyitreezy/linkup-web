import {
  PROFILE_MEDIA_MAX_PHOTOS,
  PROFILE_VIDEO_MAX_BYTES,
  PROFILE_VIDEO_MIME_TYPES,
} from '@/lib/profile/media/constants';
import { mediaTypeFromMime } from '@/lib/media/mediaType';
import { extForVideoMime, isAllowedProfileVideoMime, readVideoMetadata } from '@/lib/profile/media/videoMeta';
import { ensurePrimaryPhoto } from '@/lib/profile/media/validation';
import type { ProfileMediaDraft, ProfilePhotoDraftItem } from '@/lib/profile/media/types';
import { uploadProfilePhotos } from '@/lib/profile/uploadPhotos';
import { createClient } from '@/lib/supabase/client';

const PROFILE_VIDEO_ROLE = 'profile_video';
const VIDEO_BUCKET = 'profile-videos';
const PHOTO_BUCKET = 'avatars';

function reorderPhotoUrls(photos: ProfilePhotoDraftItem[]): { urls: string[]; primary: string | null } {
  const active = photos.filter((p) => p.url);
  if (active.length === 0) return { urls: [], primary: null };
  const primaryItem = active.find((p) => p.isPrimary) ?? active[0];
  const primary = primaryItem.url!;
  const rest = active.filter((p) => p.url !== primary).map((p) => p.url!);
  return { urls: [primary, ...rest], primary };
}

async function uploadProfileVideo(
  userId: string,
  file: File
): Promise<{
  url: string;
  storagePath: string;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  mimeType: string;
}> {
  if (file.size > PROFILE_VIDEO_MAX_BYTES) {
    throw new Error('Video is too large. Please upload a shorter clip.');
  }
  const mime = file.type || 'video/mp4';
  if (!isAllowedProfileVideoMime(mime)) {
    throw new Error('Unsupported video format. Use MP4, MOV, or WebM.');
  }

  const client = createClient();
  const { durationSeconds, thumbnailBlob } = await readVideoMetadata(file);
  const ext = extForVideoMime(mime);
  const storagePath = `${userId}/${Date.now()}-profile-video.${ext}`;

  const { error: upErr } = await client.storage.from(VIDEO_BUCKET).upload(storagePath, file, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  let thumbnailPath: string | null = null;
  if (thumbnailBlob) {
    thumbnailPath = `${userId}/${Date.now()}-profile-video-thumb.jpg`;
    const { error: thumbErr } = await client.storage.from(VIDEO_BUCKET).upload(thumbnailPath, thumbnailBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (thumbErr) thumbnailPath = null;
  }

  const { data } = client.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  return { url: data.publicUrl, storagePath, durationSeconds, thumbnailPath, mimeType: mime };
}

async function upsertProfileVideoRow(args: {
  userId: string;
  existingMediaId?: string;
  existingStoragePath?: string;
  url: string;
  storagePath: string;
  mimeType: string;
  durationSeconds: number | null;
  thumbnailPath: string | null;
}): Promise<string> {
  const client = createClient();
  const { userId, existingMediaId, existingStoragePath, url, storagePath, mimeType, durationSeconds, thumbnailPath } =
    args;

  if (existingMediaId && existingStoragePath && existingStoragePath !== storagePath) {
    await client.storage.from(VIDEO_BUCKET).remove([existingStoragePath]);
    await client.from('media').delete().eq('id', existingMediaId);
  }

  const metadata = {
    role: PROFILE_VIDEO_ROLE,
    duration_seconds: durationSeconds,
    thumbnail_path: thumbnailPath,
    thumbnail_url: thumbnailPath
      ? client.storage.from(VIDEO_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl
      : null,
  };

  const media_type = mediaTypeFromMime(mimeType);

  const payload = {
    parent_table: 'profiles',
    parent_id: userId,
    storage_bucket: VIDEO_BUCKET,
    storage_path: storagePath,
    mime_type: mimeType,
    media_type,
    media_url: url,
    metadata,
    created_by: userId,
  };

  if (existingMediaId && existingStoragePath === storagePath) {
    const { data, error } = await client
      .from('media')
      .update({ metadata, mime_type: mimeType, media_type, media_url: url })
      .eq('id', existingMediaId)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  const { data, error } = await client.from('media').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function persistProfileMediaDraft(args: {
  userId: string;
  media: ProfileMediaDraft;
  existingVideoMediaId?: string;
  existingVideoStoragePath?: string;
}): Promise<{
  photo_urls: string[];
  primary_photo_url: string | null;
  avatar_url: string | null;
  videoMediaId: string | null;
}> {
  const { userId } = args;
  let media = ensurePrimaryPhoto(args.media);
  const client = createClient();

  const resolvedPhotos: ProfilePhotoDraftItem[] = [];
  const localFiles: File[] = [];
  const localIndexes: number[] = [];

  for (const photo of media.photos) {
    if (photo.url) {
      resolvedPhotos.push(photo);
    } else if (photo.localFile) {
      localIndexes.push(resolvedPhotos.length);
      localFiles.push(photo.localFile);
      resolvedPhotos.push({ ...photo, url: null });
    }
  }

  if (localFiles.length > 0) {
    const uploaded = await uploadProfilePhotos(userId, localFiles);
    uploaded.forEach((url, i) => {
      const idx = localIndexes[i];
      resolvedPhotos[idx] = { ...resolvedPhotos[idx], url };
    });
  }

  const active = resolvedPhotos.filter((p) => p.url);
  if (active.length > PROFILE_MEDIA_MAX_PHOTOS) {
    throw new Error(`You can keep up to ${PROFILE_MEDIA_MAX_PHOTOS} photos.`);
  }

  const { urls: photo_urls, primary: primary_photo_url } = reorderPhotoUrls(
    active.map((p) => ({ ...p, url: p.url! }))
  );

  let videoMediaId: string | null = args.existingVideoMediaId ?? null;

  if (media.video?.localFile) {
    const uploaded = await uploadProfileVideo(userId, media.video.localFile);
    videoMediaId = await upsertProfileVideoRow({
      userId,
      existingMediaId: args.existingVideoMediaId,
      existingStoragePath: args.existingVideoStoragePath,
      ...uploaded,
    });
  } else if (media.video?.url && media.video.id) {
    videoMediaId = media.video.id;
  } else if (!media.video?.url && !media.video?.localFile && args.existingVideoMediaId) {
    if (args.existingVideoStoragePath) {
      await client.storage.from(VIDEO_BUCKET).remove([args.existingVideoStoragePath]);
    }
    await client.from('media').delete().eq('id', args.existingVideoMediaId);
    videoMediaId = null;
  }

  return {
    photo_urls,
    primary_photo_url,
    avatar_url: primary_photo_url,
    videoMediaId,
  };
}
