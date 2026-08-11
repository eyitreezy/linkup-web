'use client';

import {
  PROFILE_MEDIA_MAX_PHOTOS,
  PROFILE_MEDIA_MAX_VIDEOS,
  PROFILE_MEDIA_MIN_PHOTOS,
  PROFILE_MEDIA_MIN_VIDEOS,
  PROFILE_VIDEO_MAX_DURATION_SECONDS,
} from '@/lib/profile/media/constants';
import {
  addLocalPhotos,
  photoPreviewUrl,
  removePhoto,
  setPrimaryPhoto,
} from '@/lib/profile/media/draft';
import { ProfilePhotoPreviewOverlay } from '@/components/profile/ProfilePhotoPreviewOverlay';
import {
  ProfileVideoPreviewOverlay,
  type ProfileVideoPreviewItem,
} from '@/components/profile/ProfileVideoPreviewOverlay';
import {
  activePhotoCount,
  profileMediaMeetsMinimums,
  profileMediaValidationMessage,
} from '@/lib/profile/media/validation';
import { readVideoMetadata, validateProfileVideoDuration, validateProfileVideoFile } from '@/lib/profile/media/videoMeta';
import type { ProfileMediaDraft, ProfileVideoDraft } from '@/lib/profile/media/types';
import { cn } from '@/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { IoCheckmarkCircle, IoPlay, IoTrashOutline, IoVideocamOutline } from 'react-icons/io5';

type Props = {
  media: ProfileMediaDraft;
  onChange: (next: ProfileMediaDraft) => void;
  /** When set, persisted photos call this on Make Primary (immediate DB + gallery reorder). */
  onPersistPrimary?: (clientId: string) => Promise<void>;
  /** Persist media when a previously saved video is removed (prevents reappearing on reload). */
  onPersistedVideoRemoved?: (nextMedia: ProfileMediaDraft) => void | Promise<void>;
  showValidation?: boolean;
  className?: string;
};

function shiftIndexMap(map: Map<number, string>, removedIndex: number): Map<number, string> {
  const next = new Map<number, string>();
  map.forEach((value, idx) => {
    if (idx < removedIndex) next.set(idx, value);
    else if (idx > removedIndex) next.set(idx - 1, value);
  });
  return next;
}

function shiftBusyOrErrors<T>(record: Record<number, T>, removedIndex: number): Record<number, T> {
  const next: Record<number, T> = {};
  Object.entries(record).forEach(([key, value]) => {
    const idx = Number(key);
    if (idx < removedIndex) next[idx] = value;
    else if (idx > removedIndex) next[idx - 1] = value;
  });
  return next;
}

export function ProfileMediaManager({
  media,
  onChange,
  onPersistPrimary,
  onPersistedVideoRemoved,
  showValidation = true,
  className,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const localVideoThumbUrlsRef = useRef<Map<number, string>>(new Map());
  const localVideoPlaybackUrlsRef = useRef<Map<number, string>>(new Map());
  const mediaRef = useRef(media);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoPreviewIndex, setVideoPreviewIndex] = useState(0);
  const [videoPreviewRev, setVideoPreviewRev] = useState(0);
  const [videoBusySlots, setVideoBusySlots] = useState<Record<number, boolean>>({});
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [videoErrors, setVideoErrors] = useState<Record<number, string | null>>({});
  const [localVideoThumbs, setLocalVideoThumbs] = useState<Record<number, string>>({});

  const photoCount = activePhotoCount(media);
  const validationMsg = showValidation ? profileMediaValidationMessage(media) : null;

  useEffect(() => {
    return () => {
      localVideoThumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localVideoThumbUrlsRef.current.clear();
      localVideoPlaybackUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localVideoPlaybackUrlsRef.current.clear();
    };
  }, []);

  function ensureLocalPlaybackUrl(slotIndex: number, file: File): string {
    const existing = localVideoPlaybackUrlsRef.current.get(slotIndex);
    if (existing) return existing;
    const url = URL.createObjectURL(file);
    localVideoPlaybackUrlsRef.current.set(slotIndex, url);
    return url;
  }

  function videoPlaybackUrl(video: ProfileVideoDraft, slotIndex: number): string | null {
    if (video.localFile) return localVideoPlaybackUrlsRef.current.get(slotIndex) ?? null;
    return video.url;
  }

  function canPreviewVideo(video: ProfileVideoDraft, slotIndex: number): boolean {
    return !!videoPlaybackUrl(video, slotIndex) && !videoBusySlots[slotIndex];
  }

  const videoPreviewItems: ProfileVideoPreviewItem[] = media.videos.map((v, i) => ({
    playbackUrl: videoPlaybackUrl(v, i) ?? '',
    thumbnailUrl: localVideoThumbs[i] ?? v.thumbnailUrl,
    durationSeconds: v.durationSeconds,
    label: `Profile video ${i + 1}`,
  }));
  void videoPreviewRev;

  function videoThumbUrl(video: ProfileVideoDraft, slotIndex: number): string | null {
    return localVideoThumbs[slotIndex] ?? video.thumbnailUrl ?? null;
  }

  async function handleVideoPickForSlot(slotIndex: number, file: File | null) {
    if (!file) return;
    setVideoErrors((e) => ({ ...e, [slotIndex]: null }));

    const fileCheck = validateProfileVideoFile(file);
    if (!fileCheck.valid) {
      setVideoErrors((e) => ({ ...e, [slotIndex]: fileCheck.error }));
      return;
    }

    setVideoBusySlots((b) => ({ ...b, [slotIndex]: true }));

    try {
      const { durationSeconds, thumbnailBlob } = await readVideoMetadata(file);
      const durationCheck = validateProfileVideoDuration(durationSeconds);
      if (!durationCheck.valid) {
        setVideoErrors((e) => ({ ...e, [slotIndex]: durationCheck.error }));
        return;
      }

      const oldThumb = localVideoThumbUrlsRef.current.get(slotIndex);
      if (oldThumb) URL.revokeObjectURL(oldThumb);
      const oldPlayback = localVideoPlaybackUrlsRef.current.get(slotIndex);
      if (oldPlayback) URL.revokeObjectURL(oldPlayback);
      localVideoPlaybackUrlsRef.current.delete(slotIndex);

      const thumbUrl = thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : null;
      if (thumbUrl) localVideoThumbUrlsRef.current.set(slotIndex, thumbUrl);
      ensureLocalPlaybackUrl(slotIndex, file);

      const current = mediaRef.current.videos;
      const existing = current[slotIndex];
      const nextVideo: ProfileVideoDraft = {
        id: existing?.id,
        url: existing?.url ?? null,
        storagePath: existing?.storagePath,
        localFile: file,
        thumbnailUrl: thumbUrl,
        durationSeconds,
      };

      const updated =
        slotIndex < current.length
          ? current.map((v, i) => (i === slotIndex ? nextVideo : v))
          : [...current, nextVideo];

      onChange({ ...mediaRef.current, videos: updated });
      setLocalVideoThumbs((prev) => {
        const next = { ...prev };
        if (thumbUrl) next[slotIndex] = thumbUrl;
        else delete next[slotIndex];
        return next;
      });
      setVideoPreviewRev((n) => n + 1);
    } catch {
      setVideoErrors((e) => ({
        ...e,
        [slotIndex]: 'Could not read that video. Try a shorter MP4, MOV, or WebM clip.',
      }));
    } finally {
      setVideoBusySlots((b) => ({ ...b, [slotIndex]: false }));
    }
  }

  function handleRemoveVideo(slotIndex: number) {
    const removed = mediaRef.current.videos[slotIndex];
    const wasPersisted = !!(removed?.id && removed?.storagePath);

    const oldThumb = localVideoThumbUrlsRef.current.get(slotIndex);
    if (oldThumb) URL.revokeObjectURL(oldThumb);
    const oldPlayback = localVideoPlaybackUrlsRef.current.get(slotIndex);
    if (oldPlayback) URL.revokeObjectURL(oldPlayback);

    localVideoThumbUrlsRef.current = shiftIndexMap(localVideoThumbUrlsRef.current, slotIndex);
    localVideoPlaybackUrlsRef.current = shiftIndexMap(localVideoPlaybackUrlsRef.current, slotIndex);
    setLocalVideoThumbs((prev) => {
      const shifted: Record<number, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const idx = Number(key);
        if (idx < slotIndex) shifted[idx] = value;
        else if (idx > slotIndex) shifted[idx - 1] = value;
      });
      return shifted;
    });
    setVideoErrors((e) => shiftBusyOrErrors(e, slotIndex));
    setVideoBusySlots((b) => shiftBusyOrErrors(b, slotIndex));

    if (videoPreviewOpen && videoPreviewIndex === slotIndex) {
      setVideoPreviewOpen(false);
    } else if (videoPreviewOpen && videoPreviewIndex > slotIndex) {
      setVideoPreviewIndex((i) => i - 1);
    }

    const nextMedia = {
      ...mediaRef.current,
      videos: mediaRef.current.videos.filter((_, i) => i !== slotIndex),
    };
    onChange(nextMedia);

    if (wasPersisted && onPersistedVideoRemoved) {
      void onPersistedVideoRemoved(nextMedia);
    }
  }

  function openVideoPreview(slotIndex: number) {
    const video = media.videos[slotIndex];
    if (!video || !canPreviewVideo(video, slotIndex)) return;
    if (video.localFile && !localVideoPlaybackUrlsRef.current.has(slotIndex)) {
      ensureLocalPlaybackUrl(slotIndex, video.localFile);
      setVideoPreviewRev((n) => n + 1);
    }
    setVideoPreviewIndex(slotIndex);
    setVideoPreviewOpen(true);
  }

  const photoPreviewUris = media.photos.map((photo) => photoPreviewUrl(photo) ?? '');

  function openPhotoPreview(photoClientId: string) {
    const idx = media.photos.findIndex((p) => p.clientId === photoClientId);
    if (idx < 0 || !photoPreviewUris[idx]) return;
    setPhotoPreviewIndex(idx);
    setPhotoPreviewOpen(true);
  }

  const visibleVideoErrors = Object.entries(videoErrors).filter(([, msg]) => msg);

  return (
    <div className={cn('space-y-5', className)}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onChange(addLocalPhotos(mediaRef.current, files));
          e.target.value = '';
        }}
      />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold text-foreground">Photos</p>
          <p className="text-[12px] font-semibold text-muted">
            {photoCount}/{PROFILE_MEDIA_MAX_PHOTOS} · min {PROFILE_MEDIA_MIN_PHOTOS}
          </p>
        </div>
        <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted">
          Tap a photo to manage it, double-click to preview full size. Set a primary photo so it appears first across
          Discover, plans, and messages.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 min-[400px]:gap-3">
          {media.photos.map((photo) => {
            const preview = photoPreviewUrl(photo);
            const isActive = activePhotoId === photo.clientId;
            return (
              <div key={photo.clientId} className="relative">
                <button
                  type="button"
                  onClick={() => setActivePhotoId(isActive ? null : photo.clientId)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    if (preview) openPhotoPreview(photo.clientId);
                  }}
                  className={cn(
                    'group relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 bg-[#EDE8FF]/40 transition',
                    photo.isPrimary ? 'border-secondary shadow-md ring-2 ring-secondary/25' : 'border-border',
                    isActive && 'ring-2 ring-primary/40'
                  )}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">…</div>
                  )}
                  {photo.isPrimary ? (
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full linkup-gradient-primary px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm min-[400px]:text-[11px]">
                      <IoCheckmarkCircle size={12} aria-hidden />
                      Primary
                    </span>
                  ) : null}
                </button>

                {isActive ? (
                  <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 rounded-b-2xl bg-gradient-to-t from-black/80 via-black/55 to-transparent p-2 pt-8">
                    {!photo.isPrimary ? (
                      <button
                        type="button"
                        disabled={primaryBusy}
                        className="rounded-full bg-white/95 px-2 py-1.5 text-[11px] font-extrabold text-primary disabled:opacity-60"
                        onClick={() => {
                          void (async () => {
                            setPrimaryBusy(true);
                            const next = setPrimaryPhoto(mediaRef.current, photo.clientId);
                            onChange(next);
                            try {
                              if (onPersistPrimary) await onPersistPrimary(photo.clientId);
                            } finally {
                              setPrimaryBusy(false);
                              setActivePhotoId(null);
                            }
                          })();
                        }}
                      >
                        Make Primary
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-red-500/90 px-2 py-1.5 text-[11px] font-extrabold text-white"
                      onClick={() => {
                        onChange(removePhoto(mediaRef.current, photo.clientId));
                        setActivePhotoId(null);
                      }}
                    >
                      <IoTrashOutline size={13} />
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {photoCount < PROFILE_MEDIA_MAX_PHOTOS ? (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/25 bg-white/80 px-2 text-center transition hover:border-primary/45 hover:bg-[#EDE8FF]/50"
            >
              <span className="text-2xl font-extrabold text-primary">+</span>
              <span className="mt-1 text-[11px] font-extrabold text-primary">Add photo</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-foreground">
            <IoVideocamOutline className="text-secondary" size={18} />
            Profile videos
          </p>
          <p className="text-[12px] font-semibold text-muted">
            {media.videos.length}/{PROFILE_MEDIA_MAX_VIDEOS} · max {PROFILE_VIDEO_MAX_DURATION_SECONDS}s · 30MB each
          </p>
        </div>
        <p className="text-[12px] font-semibold leading-relaxed text-muted">
          Short clips build trust. Upload up to 3 videos (MP4, MOV, or WebM). Tap a clip to preview it full screen.
        </p>

        <div className="grid grid-cols-3 gap-2">
            {media.videos.map((v, i) => {
            const thumbUrl = videoThumbUrl(v, i);
            const previewable = canPreviewVideo(v, i);
            return (
              <div
                key={`${v.id ?? 'local'}-${i}`}
                className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-primary/15 bg-[#EDE8FF]/50"
              >
                {videoBusySlots[i] ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                    <span className="text-[10px] font-semibold text-muted">Processing...</span>
                  </div>
                ) : previewable ? (
                  <button
                    type="button"
                    onClick={() => openVideoPreview(i)}
                    className="group relative h-full w-full"
                    aria-label={`Preview video ${i + 1}`}
                  >
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt={`Video ${i + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#EDE8FF]/80">
                        <IoVideocamOutline size={24} className="text-muted/40" />
                      </div>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover:bg-black/30">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-primary shadow-md transition group-hover:scale-105">
                        <IoPlay size={18} className="ml-0.5" />
                      </span>
                    </span>
                  </button>
                ) : thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt={`Video ${i + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <IoVideocamOutline size={24} className="text-muted/40" />
                  </div>
                )}
                <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                  {i + 1}
                </span>
                {v.durationSeconds != null ? (
                  <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-extrabold text-white">
                    {Math.round(v.durationSeconds)}s
                  </span>
                ) : null}
                {!videoBusySlots[i] ? (
                  <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1">
                    <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80">
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        className="sr-only"
                        onChange={(e) => {
                          void handleVideoPickForSlot(i, e.target.files?.[0] ?? null);
                          e.target.value = '';
                        }}
                      />
                      <IoVideocamOutline size={12} />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-red-600/80"
                      aria-label={`Remove video ${i + 1}`}
                    >
                      <IoTrashOutline size={11} />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {media.videos.length < PROFILE_MEDIA_MAX_VIDEOS ? (
            <label className="relative flex aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/25 bg-white/80 transition hover:border-primary/45 hover:bg-[#EDE8FF]/30">
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="sr-only"
                onChange={(e) => {
                  void handleVideoPickForSlot(media.videos.length, e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              {videoBusySlots[media.videos.length] ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              ) : (
                <>
                  <IoVideocamOutline size={22} className="text-primary/50" />
                  <span className="text-[10px] font-extrabold text-primary/60">
                    {media.videos.length === 0 ? 'Add video' : 'Add another'}
                  </span>
                </>
              )}
            </label>
          ) : null}
        </div>

        {visibleVideoErrors.length > 0 ? (
          <div className="space-y-2">
            {visibleVideoErrors.map(([slot, msg]) => (
              <p
                key={slot}
                className="rounded-xl border border-red-200/90 bg-red-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-red-700"
                role="alert"
              >
                Video {Number(slot) + 1}: {msg}
              </p>
            ))}
          </div>
        ) : null}

        {showValidation && media.videos.length < PROFILE_MEDIA_MIN_VIDEOS ? (
          <p className="text-[12px] font-semibold text-[#EF4444]">Add at least 1 profile video to continue.</p>
        ) : null}
      </div>

      {validationMsg ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-900">
          {validationMsg}
        </p>
      ) : showValidation && profileMediaMeetsMinimums(media) ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-800">
          Media looks great. Primary photo and videos are set.
        </p>
      ) : null}

      <ProfilePhotoPreviewOverlay
        open={photoPreviewOpen}
        uris={photoPreviewUris}
        index={photoPreviewIndex}
        onIndexChange={setPhotoPreviewIndex}
        onClose={() => setPhotoPreviewOpen(false)}
      />

      <ProfileVideoPreviewOverlay
        open={videoPreviewOpen}
        videos={videoPreviewItems}
        index={videoPreviewIndex}
        onIndexChange={setVideoPreviewIndex}
        onClose={() => setVideoPreviewOpen(false)}
      />
    </div>
  );
}
