export const PROFILE_MEDIA_MIN_PHOTOS = 3;
export const PROFILE_MEDIA_MIN_VIDEOS = 1;
export const PROFILE_MEDIA_MAX_PHOTOS = 6;
export const PROFILE_MEDIA_MAX_VIDEOS = 3;

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_BYTES = 30 * 1024 * 1024;

/** Hard upload limit for profile videos (seconds). */
export const PROFILE_VIDEO_MAX_DURATION_SECONDS = 21;

/** Tiny float slack for encoder metadata (e.g. 21.02s for a 21s export). */
export const PROFILE_VIDEO_DURATION_TOLERANCE_SECONDS = 0.05;

export function profileVideoDurationWithinLimit(durationSeconds: number | null | undefined): boolean {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) return false;
  return durationSeconds <= PROFILE_VIDEO_MAX_DURATION_SECONDS + PROFILE_VIDEO_DURATION_TOLERANCE_SECONDS;
}

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_FILE_SIZE_BYTES = PROFILE_VIDEO_MAX_BYTES;

/** Human-readable size label for error messages. */
export const PROFILE_VIDEO_MAX_SIZE_LABEL = '30MB';

export const PROFILE_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
