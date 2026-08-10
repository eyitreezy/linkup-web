'use client';

import {
  PROFILE_MEDIA_MAX_PHOTOS,
  PROFILE_MEDIA_MIN_PHOTOS,
  PROFILE_MEDIA_MIN_VIDEOS,
} from '@/lib/profile/media/constants';
import {
  addLocalPhotos,
  photoPreviewUrl,
  removePhoto,
  setPrimaryPhoto,
} from '@/lib/profile/media/draft';
import { ProfileVideoPreview } from '@/components/profile/ProfileVideoPreview';
import { ProfilePhotoPreviewOverlay } from '@/components/profile/ProfilePhotoPreviewOverlay';
import {
  activePhotoCount,
  hasProfileVideo,
  profileMediaMeetsMinimums,
  profileMediaValidationMessage,
} from '@/lib/profile/media/validation';
import { readVideoMetadata, validateProfileVideoDuration, validateProfileVideoFile } from '@/lib/profile/media/videoMeta';
import type { ProfileMediaDraft } from '@/lib/profile/media/types';
import { cn } from '@/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { IoCheckmarkCircle, IoTrashOutline, IoVideocamOutline } from 'react-icons/io5';

type Props = {
  media: ProfileMediaDraft;
  onChange: (next: ProfileMediaDraft) => void;
  /** When set, persisted photos call this on Make Primary (immediate DB + gallery reorder). */
  onPersistPrimary?: (clientId: string) => Promise<void>;
  showValidation?: boolean;
  className?: string;
};

export function ProfileMediaManager({
  media,
  onChange,
  onPersistPrimary,
  showValidation = true,
  className,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const localVideoUrlRef = useRef<string | null>(null);
  const mediaRef = useRef(media);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [videoBusy, setVideoBusy] = useState(false);
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [localVideoPreviewUrl, setLocalVideoPreviewUrl] = useState<string | null>(null);

  const photoCount = activePhotoCount(media);
  const hasVideo = hasProfileVideo(media);
  const validationMsg = showValidation ? profileMediaValidationMessage(media) : null;

  useEffect(() => {
    if (media.video?.localFile) {
      if (localVideoUrlRef.current) URL.revokeObjectURL(localVideoUrlRef.current);
      const url = URL.createObjectURL(media.video.localFile);
      localVideoUrlRef.current = url;
      setLocalVideoPreviewUrl(url);
      return;
    }
    if (localVideoUrlRef.current) {
      URL.revokeObjectURL(localVideoUrlRef.current);
      localVideoUrlRef.current = null;
    }
    setLocalVideoPreviewUrl(null);
  }, [media.video?.localFile]);

  useEffect(() => {
    return () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current);
        localVideoUrlRef.current = null;
      }
    };
  }, []);

  async function handleVideoPick(file: File | null) {
    if (!file) return;
    setVideoError(null);

    const sizeCheck = validateProfileVideoFile(file);
    if (!sizeCheck.valid) {
      setVideoError(sizeCheck.error);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    setVideoBusy(true);

    onChange({
      ...mediaRef.current,
      video: {
        id: mediaRef.current.video?.id,
        url: mediaRef.current.video?.url ?? null,
        localFile: file,
        storagePath: mediaRef.current.video?.storagePath,
        thumbnailUrl: mediaRef.current.video?.thumbnailUrl ?? null,
        durationSeconds: mediaRef.current.video?.durationSeconds ?? null,
      },
    });

    try {
      const { durationSeconds, thumbnailBlob } = await readVideoMetadata(file);

      const durationCheck = validateProfileVideoDuration(durationSeconds);
      if (!durationCheck.valid) {
        setVideoError(durationCheck.error);
        onChange({ ...mediaRef.current, video: null });
        return;
      }

      const thumbUrl = thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : null;
      onChange({
        ...mediaRef.current,
        video: {
          id: mediaRef.current.video?.id,
          url: mediaRef.current.video?.url ?? null,
          localFile: file,
          storagePath: mediaRef.current.video?.storagePath,
          thumbnailUrl: thumbUrl,
          durationSeconds,
        },
      });
    } catch {
      setVideoError('Could not read that video. Try a shorter MP4 or WebM clip.');
      onChange({ ...mediaRef.current, video: null });
    } finally {
      setVideoBusy(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  const thumbnailPreview = media.video?.thumbnailUrl ?? null;
  const playbackUrl = localVideoPreviewUrl ?? media.video?.url ?? null;
  const photoPreviewUris = media.photos.map((photo) => photoPreviewUrl(photo) ?? '');

  function openPhotoPreview(photoClientId: string) {
    const idx = media.photos.findIndex((p) => p.clientId === photoClientId);
    if (idx < 0 || !photoPreviewUris[idx]) return;
    setPreviewIndex(idx);
    setPreviewOpen(true);
  }

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
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handleVideoPick(e.target.files?.[0] ?? null)}
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

      <div className="rounded-2xl border border-border bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-foreground">
            <IoVideocamOutline className="text-secondary" size={18} />
            Profile video
          </p>
          <p className="text-[12px] font-semibold text-muted">
            {hasVideo ? '1' : '0'}/{PROFILE_MEDIA_MIN_VIDEOS} required
          </p>
        </div>
        <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted">
          A short clip builds trust, just like on top dating apps. MP4, MOV, or WebM. Max 60 seconds and 100MB.
        </p>

        <div className="mt-3 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center">
          <div className="relative aspect-video w-full max-w-xs shrink-0 overflow-hidden rounded-2xl border border-primary/15 bg-[#EDE8FF]/50">
            {videoBusy ? (
              <div className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 text-muted">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                <span className="text-[12px] font-semibold">Processing video…</span>
              </div>
            ) : hasVideo && playbackUrl ? (
              <ProfileVideoPreview
                compact
                playbackUrl={playbackUrl}
                thumbnailUrl={thumbnailPreview}
                durationSeconds={media.video?.durationSeconds}
              />
            ) : (
              <div className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 text-muted">
                <IoVideocamOutline size={32} />
                <span className="text-[12px] font-semibold">No video yet</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={videoBusy}
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex min-h-[40px] cursor-pointer items-center rounded-full linkup-gradient-primary px-4 py-2 text-[12px] font-extrabold text-white shadow-sm disabled:opacity-60"
            >
              {hasVideo ? 'Replace video' : 'Upload video'}
            </button>
            {hasVideo ? (
              <button
                type="button"
                disabled={videoBusy}
                className="inline-flex min-h-[40px] items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-extrabold text-red-600 disabled:opacity-60"
                onClick={() => {
                  setVideoError(null);
                  onChange({ ...mediaRef.current, video: null });
                  if (videoInputRef.current) videoInputRef.current.value = '';
                }}
              >
                Delete video
              </button>
            ) : null}
          </div>
        </div>

        {videoError ? (
          <p className="mt-3 text-[12px] font-semibold text-red-600">{videoError}</p>
        ) : null}
      </div>

      {validationMsg ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-900">
          {validationMsg}
        </p>
      ) : showValidation && profileMediaMeetsMinimums(media) ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-800">
          Media looks great. Primary photo and video are set.
        </p>
      ) : null}

      <ProfilePhotoPreviewOverlay
        open={previewOpen}
        uris={photoPreviewUris}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
