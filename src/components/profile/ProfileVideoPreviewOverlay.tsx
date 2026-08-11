'use client';

import { formatVideoDuration } from '@/lib/profile/media/resolve';
import { cn } from '@/utils/cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBack, IoChevronForward, IoClose, IoVideocamOutline } from 'react-icons/io5';

export type ProfileVideoPreviewItem = {
  playbackUrl: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  label?: string;
};

type Props = {
  open: boolean;
  videos: ProfileVideoPreviewItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function ProfileVideoPreviewOverlay({ open, videos, index, onIndexChange, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  const playableIndexes = useMemo(
    () => videos.map((v, i) => (v.playbackUrl ? i : -1)).filter((i) => i >= 0),
    [videos]
  );

  const safeIndex = playableIndexes.includes(index)
    ? index
    : playableIndexes[0] ?? 0;
  const current = videos[safeIndex];
  const showNav = playableIndexes.length > 1;
  const positionInList = Math.max(0, playableIndexes.indexOf(safeIndex));

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!showNav || playableIndexes.length === 0) return;
      const pos = playableIndexes.indexOf(safeIndex);
      const base = pos >= 0 ? pos : 0;
      if (e.key === 'ArrowLeft') {
        onIndexChange(playableIndexes[(base - 1 + playableIndexes.length) % playableIndexes.length]);
      }
      if (e.key === 'ArrowRight') {
        onIndexChange(playableIndexes[(base + 1) % playableIndexes.length]);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, showNav, onClose, onIndexChange, safeIndex, playableIndexes]);

  useEffect(() => {
    setReady(false);
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, [current?.playbackUrl, open]);

  function go(delta: number) {
    if (playableIndexes.length === 0) return;
    const pos = playableIndexes.indexOf(safeIndex);
    const base = pos >= 0 ? pos : 0;
    const next = playableIndexes[(base + delta + playableIndexes.length) % playableIndexes.length];
    onIndexChange(next);
  }

  if (!open || !current?.playbackUrl) return null;

  const title = current.label ?? `Profile video ${safeIndex + 1}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[rgba(8,10,18,0.96)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Video preview"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close preview" onClick={onClose} />

      <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-4 sm:pt-6">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-white/95">
            <IoVideocamOutline size={16} className="text-secondary" />
            {title}
          </p>
          {showNav ? (
            <p className="mt-0.5 text-[12px] font-semibold text-white/55">
              {positionInList + 1} of {playableIndexes.length}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close preview"
        >
          <IoClose size={22} />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-3">
        {showNav ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className={cn(
                'absolute left-2 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full',
                'border border-white/20 bg-white/10 text-white transition hover:bg-white/20 sm:left-4'
              )}
              aria-label="Previous video"
            >
              <IoChevronBack size={24} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className={cn(
                'absolute right-2 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full',
                'border border-white/20 bg-white/10 text-white transition hover:bg-white/20 sm:right-4'
              )}
              aria-label="Next video"
            >
              <IoChevronForward size={24} />
            </button>
          </>
        ) : null}

        <div className="relative w-full max-w-sm">
          <div className="rounded-[1.35rem] p-[2px] linkup-gradient-primary shadow-2xl shadow-primary/25">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[1.2rem] bg-black">
              {!ready && current.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-80"
                />
              ) : null}
              {!ready ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                </div>
              ) : null}
              <video
                ref={videoRef}
                key={current.playbackUrl}
                src={current.playbackUrl}
                controls
                autoPlay
                playsInline
                className={cn('h-full w-full object-contain', !ready && 'opacity-0')}
                onLoadedData={() => setReady(true)}
                onCanPlay={() => setReady(true)}
              />
              {current.durationSeconds != null ? (
                <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-white">
                  {formatVideoDuration(current.durationSeconds)}
                </span>
              ) : null}
            </div>
          </div>

          {showNav ? (
            <div className="mt-3 flex justify-center gap-1.5">
              {playableIndexes.map((slotIndex) => (
                <button
                  key={slotIndex}
                  type="button"
                  onClick={() => onIndexChange(slotIndex)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    slotIndex === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/55'
                  )}
                  aria-label={`View video ${slotIndex + 1}`}
                  aria-current={slotIndex === safeIndex ? 'true' : undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <p className="relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[12px] font-semibold text-white/50">
        Tap outside or press Esc to close
      </p>
    </div>
  );
}
