export const PROFILE_MEDIA_MIN_PHOTOS = 3;
export const PROFILE_MEDIA_MIN_VIDEOS = 1;
export const PROFILE_MEDIA_MAX_PHOTOS = 6;
export const PROFILE_MEDIA_MAX_VIDEOS = 3;

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_BYTES = 30 * 1024 * 1024;

/** Maximum profile video duration in seconds. */
export const PROFILE_VIDEO_MAX_DURATION_SECONDS = 20;

/**
 * Encoders and browsers often report a few frames over the nominal cut (e.g. 20.04s for a 20s export).
 * Validation allows this slack so "max 20s" clips at exactly 20s are not rejected.
 */
export const PROFILE_VIDEO_DURATION_TOLERANCE_SECONDS = 0.5;

export function profileVideoDurationWithinLimit(durationSeconds: number | null | undefined): boolean {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) return true;
  return durationSeconds <= PROFILE_VIDEO_MAX_DURATION_SECONDS + PROFILE_VIDEO_DURATION_TOLERANCE_SECONDS;
}

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_FILE_SIZE_BYTES = PROFILE_VIDEO_MAX_BYTES;

/** Human-readable size label for error messages. */
export const PROFILE_VIDEO_MAX_SIZE_LABEL = '30MB';

export const PROFILE_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
