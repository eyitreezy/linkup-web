export const PROFILE_MEDIA_MIN_PHOTOS = 3;
export const PROFILE_MEDIA_MIN_VIDEOS = 1;
export const PROFILE_MEDIA_MAX_PHOTOS = 6;
export const PROFILE_MEDIA_MAX_VIDEOS = 3;

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_BYTES = 30 * 1024 * 1024;

/** Maximum profile video duration in seconds. */
export const PROFILE_VIDEO_MAX_DURATION_SECONDS = 20;

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_FILE_SIZE_BYTES = PROFILE_VIDEO_MAX_BYTES;

/** Human-readable size label for error messages. */
export const PROFILE_VIDEO_MAX_SIZE_LABEL = '30MB';

export const PROFILE_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
