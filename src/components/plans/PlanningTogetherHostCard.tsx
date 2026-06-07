'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { resolvePrimaryPhotoUrl } from '@/lib/profile/media/resolve';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';
import type { ProfileMini } from '@/services/planDetail.service';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoChevronForward, IoShieldCheckmark } from 'react-icons/io5';

type Props = {
  profile: ProfileMini | undefined;
  roleLabel: string;
  userId: string;
  presence?: PresenceUi | null;
  className?: string;
};

export function PlanningTogetherHostCard({ profile, roleLabel, userId, presence = null, className }: Props) {
  const name = profile?.display_name?.trim() || 'Member';
  const avatar = resolvePrimaryPhotoUrl(profile ?? null) ?? profile?.avatar_url;

  return (
    <Link
      href={`/user/${userId}`}
      className={cn(
        'group mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-white/90 p-3 shadow-sm transition',
        'hover:border-primary/25 hover:bg-white hover:shadow-md active:scale-[0.98]',
        className
      )}
    >
      <AvatarWithPresence
        uri={avatar}
        name={name}
        size={52}
        presence={presence ?? null}
        showDot={!!presence?.dot}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-extrabold text-foreground">{name}</p>
          {profile?.verified_badge ? (
            <IoShieldCheckmark className="shrink-0 text-emerald-600" size={16} aria-label="Verified" />
          ) : null}
        </div>
        <p className="text-[12px] font-semibold text-muted">{roleLabel}</p>
        {profile?.location_label ? (
          <p className="mt-0.5 truncate text-[11px] font-semibold text-muted/80">{profile.location_label}</p>
        ) : null}
        <p className="mt-1.5 text-[11px] font-extrabold text-primary transition group-hover:text-primary/80">
          View member profile
        </p>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE8FF]/80 text-primary transition group-hover:bg-[#EDE8FF]">
        <IoChevronForward size={18} />
      </span>
    </Link>
  );
}
