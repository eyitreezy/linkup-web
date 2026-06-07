'use client';

import { formatVideoDuration } from '@/lib/profile/media/resolve';
import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';
import { IoPlay } from 'react-icons/io5';

type Props = {
  playbackUrl: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  className?: string;
  /** When true, play button is smaller for compact edit/onboarding previews. */
  compact?: boolean;
};

export function ProfileVideoPreview({
  playbackUrl,
  thumbnailUrl = null,
  durationSeconds = null,
  className,
  compact = false,
}: Props) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
  }, [playbackUrl]);

  if (!playbackUrl) {
    return null;
  }

  const playButtonSize = compact ? 'h-11 w-11' : 'h-14 w-14';
  const playIconSize = compact ? 22 : 28;

  return (
    <div className={cn('relative h-full w-full', className)}>
      {playing ? (
        <video
          src={playbackUrl}
          controls
          autoPlay
          playsInline
          className={cn('h-full w-full', compact ? 'object-cover' : 'object-contain')}
        />
      ) : (
        <>
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <video src={playbackUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          )}
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/30"
            aria-label="Play profile video"
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full bg-white/95 text-primary shadow-md',
                playButtonSize
              )}
            >
              <IoPlay size={playIconSize} className="ml-0.5" />
            </span>
          </button>
          {durationSeconds != null ? (
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
              {formatVideoDuration(durationSeconds)}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
