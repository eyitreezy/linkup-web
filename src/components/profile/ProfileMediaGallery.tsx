'use client';

import { ProfileVideoPreview } from '@/components/profile/ProfileVideoPreview';
import { bundleProfileMedia } from '@/lib/profile/media/resolve';
import type { DbProfileVideo } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import { IoCheckmarkCircle } from 'react-icons/io5';

type Props = {
  profile: Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url' | 'display_name'>;
  videos?: DbProfileVideo[];
  /** compact = avatar row; full = discover-style hero grid */
  variant?: 'compact' | 'full';
  className?: string;
};

export function ProfileMediaGallery({ profile, videos = [], variant = 'full', className }: Props) {
  const bundle = bundleProfileMedia(profile, videos[0] ?? null);
  const [activePhoto, setActivePhoto] = useState(0);
  const photos = bundle.galleryPhotoUrls;
  const hero = photos[activePhoto] ?? bundle.primaryPhotoUrl;

  if (variant === 'compact') {
    const thumb = bundle.primaryPhotoUrl;
    return (
      <div className={cn('shrink-0', className)}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-14 w-14 rounded-2xl border-2 border-secondary/30 object-cover shadow-sm" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDE8FF] text-lg font-extrabold text-primary">
            {(profile.display_name ?? '?').charAt(0)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-primary/10 bg-[#EDE8FF]/40 shadow-md min-[400px]:aspect-[3/4]">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">No photos</div>
        )}
        {activePhoto === 0 && bundle.primaryPhotoUrl ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full linkup-gradient-primary px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
            <IoCheckmarkCircle size={14} />
            Primary
          </span>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActivePhoto(i)}
              className={cn(
                'relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition min-[400px]:h-20 min-[400px]:w-[4.5rem]',
                activePhoto === i ? 'border-primary ring-2 ring-primary/20' : 'border-border opacity-80 hover:opacity-100'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute bottom-0.5 left-0.5 rounded bg-secondary/90 px-1 text-[8px] font-extrabold text-white">
                  ★
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div className="space-y-2">
          {videos.map((video, i) => (
            <ProfileVideoCard key={video.id} video={video} label={videos.length > 1 ? `Profile video ${i + 1}` : undefined} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProfileVideoCard({
  video,
  label,
  className,
}: {
  video: DbProfileVideo;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-primary/15 bg-white/90', className)}>
      <div className="relative aspect-video w-full bg-black/5">
        <ProfileVideoPreview
          playbackUrl={video.url}
          thumbnailUrl={video.thumbnailUrl}
          durationSeconds={video.durationSeconds}
        />
      </div>
      <p className="px-3 py-2 text-[12px] font-semibold text-muted">{label ?? 'Profile video'}</p>
    </div>
  );
}
