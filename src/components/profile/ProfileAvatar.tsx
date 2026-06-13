'use client';

import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import type { DbProfile } from '@/types/database';
import { cn } from '@/utils/cn';

type ProfilePhotoFields = Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'>;

export function profileFirstNameInitial(displayName: string | null | undefined): string {
  const token = displayName?.trim().split(/\s+/).filter(Boolean)[0];
  return (token?.[0] ?? '?').toUpperCase();
}

type Props = {
  profile: ProfilePhotoFields | null | undefined;
  displayName?: string | null;
  size?: number;
  className?: string;
  ringClassName?: string;
};

export function ProfileAvatar({
  profile,
  displayName,
  size = 40,
  className,
  ringClassName,
}: Props) {
  const name = displayName?.trim() || 'Member';
  const uri = resolvePrimaryPhotoUrl(profile ?? null);
  const initial = profileFirstNameInitial(name);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        ringClassName,
        !uri && 'bg-primary/10 font-extrabold text-primary',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={uri} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
