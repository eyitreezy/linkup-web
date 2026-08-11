import {
  PROFILE_VIDEO_MAX_DURATION_SECONDS,
  PROFILE_VIDEO_MAX_FILE_SIZE_BYTES,
  PROFILE_VIDEO_MAX_SIZE_LABEL,
  PROFILE_VIDEO_MIME_TYPES,
  profileVideoDurationWithinLimit,
} from '@/lib/profile/media/constants';

export const PROFILE_VIDEO_ALLOWED_FORMATS_LABEL = 'MP4, MOV, or WebM';

export function isAllowedProfileVideoMime(mime: string): boolean {
  return (PROFILE_VIDEO_MIME_TYPES as readonly string[]).includes(mime);
}

export function extForVideoMime(mime: string): string {
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  return 'mp4';
}

function loadVideoMetadata(
  video: HTMLVideoElement,
  url: string
): Promise<{ durationSeconds: number | null; width: number; height: number }> {
  return new Promise((resolve) => {
    const done = (result: { durationSeconds: number | null; width: number; height: number }) => {
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      done({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || 640,
        height: video.videoHeight || 360,
      });
    };
    video.onerror = () => done({ durationSeconds: null, width: 640, height: 360 });
    video.src = url;
  });
}

function captureThumbnail(video: HTMLVideoElement, url: string, width: number, height: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      resolve(blob);
    };

    const timer = window.setTimeout(() => finish(null), 5000);

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      try {
        const seekTo = Math.min(0.5, Math.max(0.05, (video.duration || 1) * 0.1));
        video.currentTime = seekTo;
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        finish(null);
        return;
      }
      ctx.drawImage(video, 0, 0, width, height);
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.82);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    video.src = url;
  });
}

export async function readVideoMetadata(
  file: File
): Promise<{ durationSeconds: number | null; thumbnailBlob: Blob | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);

  try {
    const { durationSeconds, width, height } = await loadVideoMetadata(video, url);
    const thumbnailBlob = await captureThumbnail(video, url, width, height);
    return { durationSeconds, thumbnailBlob };
  } finally {
    video.remove();
    URL.revokeObjectURL(url);
  }
}

export function validateProfileVideoMime(
  file: File
): { valid: boolean; error: string | null } {
  const mime = (file.type || '').toLowerCase();
  if (mime && !isAllowedProfileVideoMime(mime)) {
    return {
      valid: false,
      error: `Video type is not ${PROFILE_VIDEO_ALLOWED_FORMATS_LABEL}. Please choose a supported format and try again.`,
    };
  }

  const name = file.name.toLowerCase();
  const extOk = /\.(mp4|mov|webm)$/.test(name);
  if (!mime && !extOk) {
    return {
      valid: false,
      error: `Video type is not ${PROFILE_VIDEO_ALLOWED_FORMATS_LABEL}. Please choose a supported format and try again.`,
    };
  }

  return { valid: true, error: null };
}

export function validateProfileVideoFile(
  file: File
): { valid: boolean; error: string | null } {
  const mimeCheck = validateProfileVideoMime(file);
  if (!mimeCheck.valid) return mimeCheck;

  if (file.size > PROFILE_VIDEO_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Video size is greater than ${PROFILE_VIDEO_MAX_SIZE_LABEL}. Please trim or compress it and try again.`,
    };
  }
  return { valid: true, error: null };
}

export function validateProfileVideoDuration(
  durationSeconds: number | null
): { valid: boolean; error: string | null } {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) {
    return {
      valid: false,
      error: `Could not read video length. Try a shorter MP4, MOV, or WebM clip (max ${PROFILE_VIDEO_MAX_DURATION_SECONDS} seconds).`,
    };
  }
  if (!profileVideoDurationWithinLimit(durationSeconds)) {
    return {
      valid: false,
      error: `Video length is greater than ${PROFILE_VIDEO_MAX_DURATION_SECONDS} seconds. Please trim it and try again.`,
    };
  }
  return { valid: true, error: null };
}
