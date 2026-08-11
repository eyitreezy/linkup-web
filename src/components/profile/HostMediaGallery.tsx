'use client';

import {
  buildHostMediaSequence,
  type HostMediaItem,
} from '@/lib/profile/media/hostMediaSequence';
import { formatVideoDuration } from '@/lib/profile/media/resolve';
import type { DbProfileVideo } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCheckmarkCircle, IoPlay, IoVolumeHigh, IoVolumeMute } from 'react-icons/io5';

type Props = {
  profile: Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url' | 'display_name'> | null;
  videos?: DbProfileVideo[];
  className?: string;
};

export function HostMediaGallery({ profile, videos = [], className }: Props) {
  const items = useMemo(() => buildHostMediaSequence(profile, videos), [profile, videos]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const count = items.length;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    if (index >= count && count > 0) setIndex(count - 1);
  }, [count, index]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  function onTapZone(clientX: number, width: number) {
    if (width <= 0) return;
    const ratio = clientX / width;
    if (ratio < 0.33) goPrev();
    else if (ratio > 0.67) goNext();
  }

  const displayName = profile?.display_name?.trim() || 'Member';

  if (count === 0) {
    return (
      <div
        className={cn(
          'relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-[#EDE8FF] via-[#FFF0F5] to-[#E8FAF4] min-[400px]:aspect-[3/4] md:aspect-[16/10] md:max-h-[28rem]',
          className
        )}
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 font-display text-2xl font-extrabold text-primary shadow-sm">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <p className="text-[13px] font-semibold">No media yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-[4/5] w-full select-none overflow-hidden bg-[#1a1530] min-[400px]:aspect-[3/4] md:aspect-[16/10] md:max-h-[28rem]',
        className
      )}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < 40) return;
        if (delta < 0) goNext();
        else goPrev();
      }}
      onClick={(e) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        onTapZone(e.clientX - rect.left, rect.width);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') goNext();
        if (e.key === 'ArrowLeft') goPrev();
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${displayName} profile media`}
      tabIndex={0}
      ref={trackRef}
    >
      <div
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {items.map((item, i) => (
          <div key={item.id} className="relative h-full w-full shrink-0">
            {item.kind === 'photo' ? (
              <PhotoSlide
                item={item}
                loaded={!!loaded[item.id]}
                onLoad={() => setLoaded((m) => ({ ...m, [item.id]: true }))}
              />
            ) : (
              <VideoSlide item={item} active={i === safeIndex} />
            )}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pb-2 pt-3">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/30 p-0"
              aria-label={`View ${item.kind === 'video' ? 'intro video' : 'photo'} ${i + 1} of ${count}`}
              aria-current={i === safeIndex ? 'true' : undefined}
            >
              <span
                className={cn(
                  'block h-full rounded-full bg-white transition-all duration-300',
                  i === safeIndex ? 'w-full opacity-100' : i < safeIndex ? 'w-full opacity-45' : 'w-0 opacity-0'
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      {items[safeIndex]?.kind === 'photo' && items[safeIndex].isPrimary ? (
        <span className="pointer-events-none absolute left-3 top-8 z-20 inline-flex items-center gap-1 rounded-full linkup-gradient-primary px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
          <IoCheckmarkCircle size={14} />
          Primary
        </span>
      ) : null}

      {items[safeIndex]?.kind === 'video' ? (
        <span className="pointer-events-none absolute left-3 top-8 z-20 rounded-full bg-secondary/90 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
          Intro video
        </span>
      ) : null}

      {count > 1 ? (
        <p className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-white">
          {safeIndex + 1} / {count}
        </p>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}

function PhotoSlide({
  item,
  loaded,
  onLoad,
}: {
  item: Extract<HostMediaItem, { kind: 'photo' }>;
  loaded: boolean;
  onLoad: () => void;
}) {
  return (
    <>
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#EDE8FF]/80 to-[#FFF0F5]/60" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt=""
        className={cn('h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        draggable={false}
        onLoad={onLoad}
      />
    </>
  );
}

function VideoSlide({
  item,
  active,
}: {
  item: Extract<HostMediaItem, { kind: 'video' }>;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!active) {
      const el = videoRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      setPlaying(false);
    }
  }, [active]);

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    setMuted((m) => !m);
  }

  return (
    <div className="relative h-full w-full bg-black">
      {item.thumbnailUrl && !playing ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : null}
      <video
        ref={videoRef}
        src={item.url}
        className="h-full w-full object-cover"
        playsInline
        muted={muted}
        preload="metadata"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center"
        aria-label={playing ? 'Pause video' : 'Play video'}
      >
        {!playing ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-primary shadow-lg transition active:scale-95">
            <IoPlay size={32} className="ml-1" />
          </span>
        ) : null}
      </button>
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-2">
        <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-extrabold tabular-nums text-white">
          {formatVideoDuration(item.durationSeconds)}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70 active:scale-95"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? <IoVolumeMute size={18} /> : <IoVolumeHigh size={18} />}
        </button>
      </div>
    </div>
  );
}
