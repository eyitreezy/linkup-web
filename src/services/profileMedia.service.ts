import type { SupabaseClient } from '@supabase/supabase-js';
import { PROFILE_MEDIA_MAX_VIDEOS } from '@/lib/profile/media/constants';
import type { DbProfileVideo } from '@/lib/profile/media/types';

const PROFILE_VIDEO_ROLE = 'profile_video';

type MediaRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
};

function rowToVideo(row: MediaRow, client: SupabaseClient): DbProfileVideo {
  const meta = row.metadata ?? {};
  const { data } = client.storage.from(row.storage_bucket).getPublicUrl(row.storage_path);
  const thumbPath = typeof meta.thumbnail_path === 'string' ? meta.thumbnail_path : null;
  const thumbUrl = thumbPath
    ? client.storage.from(row.storage_bucket).getPublicUrl(thumbPath).data.publicUrl
    : typeof meta.thumbnail_url === 'string'
      ? meta.thumbnail_url
      : null;
  return {
    id: row.id,
    url: data.publicUrl,
    storagePath: row.storage_path,
    thumbnailUrl: thumbUrl,
    durationSeconds:
      typeof meta.duration_seconds === 'number' && Number.isFinite(meta.duration_seconds)
        ? meta.duration_seconds
        : null,
    mimeType: row.mime_type,
  };
}

function isProfileVideoRow(row: MediaRow): boolean {
  return (row.metadata?.role === PROFILE_VIDEO_ROLE || (row.mime_type ?? '').startsWith('video/')) && !!row.storage_path;
}

export async function fetchProfileVideos(
  client: SupabaseClient,
  userId: string
): Promise<DbProfileVideo[]> {
  const { data, error } = await client
    .from('media')
    .select('id, storage_bucket, storage_path, mime_type, metadata')
    .eq('parent_table', 'profiles')
    .eq('parent_id', userId)
    .order('created_at', { ascending: true })
    .limit(PROFILE_MEDIA_MAX_VIDEOS);

  if (error || !data?.length) return [];

  return (data as MediaRow[])
    .filter(isProfileVideoRow)
    .map((row) => rowToVideo(row, client));
}

export async function fetchProfileVideo(
  client: SupabaseClient,
  userId: string
): Promise<DbProfileVideo | null> {
  const videos = await fetchProfileVideos(client, userId);
  return videos[0] ?? null;
}

export async function fetchProfileVideosByUserIds(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, DbProfileVideo[]>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, DbProfileVideo[]>();
  if (unique.length === 0) return map;

  const { data, error } = await client
    .from('media')
    .select('id, parent_id, storage_bucket, storage_path, mime_type, metadata, created_at')
    .eq('parent_table', 'profiles')
    .in('parent_id', unique)
    .order('created_at', { ascending: true });

  if (error || !data) return map;

  for (const row of data as (MediaRow & { parent_id: string })[]) {
    if (!isProfileVideoRow(row)) continue;
    const list = map.get(row.parent_id) ?? [];
    if (list.length >= PROFILE_MEDIA_MAX_VIDEOS) continue;
    list.push(rowToVideo(row, client));
    map.set(row.parent_id, list);
  }
  return map;
}

export async function deleteProfileVideoMedia(client: SupabaseClient, mediaId: string, storageBucket: string, storagePath: string) {
  await client.storage.from(storageBucket).remove([storagePath]);
  await client.from('media').delete().eq('id', mediaId);
}

export function profileVideoPersistMeta(
  videos: DbProfileVideo[]
): Array<{ id: string; storagePath: string }> {
  return videos
    .filter((v) => v.id && v.storagePath)
    .map((v) => ({ id: v.id, storagePath: v.storagePath }));
}
