'use client';

import { MeetTypeIcon } from '@/components/plans/MeetTypeIcon';
import { resolveMeetTypeCoverUrl } from '@/lib/plans/resolveMeetTypeCoverUrl';
import { canUserManageMeetType, isCatalogMeetType, isPendingMeetType } from '@/lib/plans/meetTypes';
import { meetTypeGradient, meetTypeGradientStyle } from '@/lib/plans/meetTypeVisuals';
import type { DbMeetType } from '@/types/database';
import { cn } from '@/utils/cn';

type Props = {
  type: DbMeetType;
  userId: string | undefined;
  onPress: (type: DbMeetType) => void;
  pending?: boolean;
};

/** Tinder Explore–style portrait tile — full bleed visual, title on bottom scrim. */
const exploreTileClass = cn(
  'group relative aspect-[3/4] w-full min-w-0 overflow-hidden rounded-[20px] text-left',
  'ring-1 ring-black/[0.05]',
  'shadow-[0_8px_24px_rgba(42,31,85,0.10)]',
  'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
  'hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(42,31,85,0.15)]',
  'active:translate-y-0 active:scale-[0.98]'
);

function TileTitleOverlay({
  title,
  description,
}: {
  title: string;
  description?: string | null;
}) {
  const hasDescription = !!description;
  const revealOnInteraction = cn(
    'group-hover:top-[15%] group-hover:flex group-hover:flex-col group-hover:justify-end',
    'group-hover:from-black/94 group-hover:via-black/75',
    'group-active:top-[15%] group-active:flex group-active:flex-col group-active:justify-end',
    'group-active:from-black/94 group-active:via-black/75',
    'group-focus-visible:top-[15%] group-focus-visible:flex group-focus-visible:flex-col group-focus-visible:justify-end',
    'group-focus-visible:from-black/94 group-focus-visible:via-black/75'
  );
  const hideTitleOnInteraction = cn(
    'group-hover:opacity-0 group-hover:invisible group-hover:absolute',
    'group-active:opacity-0 group-active:invisible group-active:absolute',
    'group-focus-visible:opacity-0 group-focus-visible:invisible group-focus-visible:absolute'
  );
  const showDescriptionOnInteraction = cn(
    'group-hover:max-h-none group-hover:flex-1 group-hover:overflow-visible group-hover:opacity-100',
    'group-active:max-h-none group-active:flex-1 group-active:overflow-visible group-active:opacity-100',
    'group-focus-visible:max-h-none group-focus-visible:flex-1 group-focus-visible:overflow-visible group-focus-visible:opacity-100'
  );

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 px-3.5 pb-3.5',
        'bg-gradient-to-t from-black/80 via-black/45 to-transparent',
        'transition-[background,top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        hasDescription ? cn('pt-12', revealOnInteraction) : 'pt-16'
      )}
    >
      {hasDescription ? (
        <>
          <p
            className={cn(
              'font-display text-[15px] font-bold leading-snug tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] line-clamp-2',
              'transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              hideTitleOnInteraction
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'max-h-0 overflow-hidden text-[12px] font-semibold leading-relaxed text-white/90 opacity-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
              'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              showDescriptionOnInteraction
            )}
          >
            {description}
          </p>
        </>
      ) : (
        <p className="font-display text-[15px] font-bold leading-snug tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] line-clamp-2">
          {title}
        </p>
      )}
    </div>
  );
}

function meetTypeAriaLabel(name: string, description?: string | null): string {
  if (description) return `${name}. ${description}`;
  return `Browse ${name} meetups`;
}

function OwnedBadge() {
  return (
    <span className="absolute right-2.5 top-2.5 z-10 rounded-full border border-white/35 bg-black/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
      Yours
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="absolute right-2.5 top-2.5 z-10 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-900 backdrop-blur-sm">
      Pending
    </span>
  );
}

function CatalogMeetTypeCard({
  type,
  onPress,
  pending,
}: {
  type: DbMeetType;
  onPress: (type: DbMeetType) => void;
  pending?: boolean;
}) {
  const coverUrl = resolveMeetTypeCoverUrl(type);

  return (
    <button
      type="button"
      onClick={() => onPress(type)}
      className={cn(exploreTileClass, pending && 'opacity-45')}
      aria-label={meetTypeAriaLabel(type.name, type.description)}
    >
      {pending ? <PendingBadge /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
        loading="lazy"
      />
      <span
        className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/[0.08]"
        aria-hidden
      />
      <TileTitleOverlay title={type.name} description={type.description} />
    </button>
  );
}

function CustomMeetTypeCard({
  type,
  userId,
  onPress,
  pending,
}: {
  type: DbMeetType;
  userId: string | undefined;
  onPress: (type: DbMeetType) => void;
  pending?: boolean;
}) {
  const owned = canUserManageMeetType(type, userId) && !pending;
  const [accent] = meetTypeGradient(type);

  return (
    <button
      type="button"
      onClick={() => onPress(type)}
      className={cn(exploreTileClass, pending && 'opacity-45')}
      aria-label={meetTypeAriaLabel(type.name, type.description)}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundImage: meetTypeGradientStyle(type) }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.18),transparent_55%)]"
        aria-hidden
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10">
        <span
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/[0.96] shadow-[0_6px_20px_rgba(42,31,85,0.18)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
          style={{ color: accent }}
        >
          <MeetTypeIcon icon={type.icon} size={36} className="!text-current" />
        </span>
      </span>
      {pending ? <PendingBadge /> : owned ? <OwnedBadge /> : null}
      <TileTitleOverlay title={type.name} description={type.description} />
    </button>
  );
}

export function MeetTypeExploreCard({ type, userId, onPress, pending }: Props) {
  const isPending = pending ?? isPendingMeetType(type, userId);
  if (isCatalogMeetType(type)) {
    return <CatalogMeetTypeCard type={type} onPress={onPress} pending={isPending} />;
  }
  return <CustomMeetTypeCard type={type} userId={userId} onPress={onPress} pending={isPending} />;
}

/** Loading placeholder matching explore tile layout. */
export function MeetTypeExploreCardSkeleton() {
  return (
    <div className={cn(exploreTileClass, 'bg-neutral-200/80 animate-pulse')}>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="absolute bottom-3.5 left-3.5 h-4 w-2/3 rounded-md bg-white/40" />
    </div>
  );
}

export const meetrGridClass =
  'grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[640px]:gap-2.5 min-[1024px]:grid-cols-4 min-[1200px]:gap-3';
