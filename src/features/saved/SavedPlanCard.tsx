'use client';

import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import type { SavedPlanListItem } from '@/services/savedPlans.service';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoBookmark, IoCheckmarkCircle, IoChevronForward } from 'react-icons/io5';

type Props = {
  item: SavedPlanListItem;
  onUnsave: () => void;
  unsaving?: boolean;
};

function HostAvatar({ url, name, size = 'md' }: { url: string | null; name: string; size?: 'sm' | 'md' }) {
  const initial = name.charAt(0).toUpperCase();
  const dim =
    size === 'sm'
      ? 'h-11 w-11 text-[15px] min-[360px]:h-12 min-[360px]:w-12'
      : 'h-12 w-12 text-[16px] min-[360px]:h-[52px] min-[360px]:w-[52px] sm:h-14 sm:w-14';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={cn('shrink-0 rounded-full object-cover', dim)} />
    );
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary',
        dim
      )}
    >
      {initial}
    </div>
  );
}

export function SavedPlanCard({ item, onUnsave, unsaving }: Props) {
  const { plan, creator } = item;
  const name = creator.display_name?.trim() || 'Host';
  const when = formatPlanWhen(plan);
  const price = formatPlanPrice(plan);
  const loc = plan.location_label?.trim() ?? 'Location TBC';
  const avatarUrl = creator.avatar_url;
  const showHeroRail = !!avatarUrl;

  return (
    <article className="linkup-card w-full min-w-0 overflow-hidden rounded-[18px] min-[360px]:rounded-[20px] sm:rounded-2xl">
      <div className="flex w-full min-w-0">
        <div
          className="w-1 shrink-0 self-stretch bg-gradient-to-b from-[#FF6584] via-primary to-[#10B981]"
          aria-hidden
        />

        <Link
          href={`/plan/${plan.id}`}
          className="group flex min-w-0 flex-1 flex-col transition hover:opacity-[0.98] sm:flex-row sm:items-stretch"
        >
          {showHeroRail ? (
            <div className="relative hidden min-h-[120px] w-[32%] max-w-[200px] shrink-0 bg-gradient-to-br from-[#EDE8FF] to-[#FFF0F5] sm:block md:w-[34%] md:max-w-[220px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 items-start gap-2 py-3 pl-2.5 pr-1 min-[360px]:gap-2.5 min-[360px]:py-3.5 min-[360px]:pl-3 sm:gap-3 sm:py-4 sm:pl-4 sm:pr-2">
            <div className={cn('shrink-0', showHeroRail && 'sm:hidden')}>
              <HostAvatar url={avatarUrl} name={name} size={showHeroRail ? 'sm' : 'md'} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[15px] font-extrabold leading-snug text-foreground line-clamp-2 min-[360px]:text-[16px] sm:pr-1 sm:text-[17px]">
                {plan.title}
              </h3>
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] font-semibold text-muted min-[360px]:mt-1 min-[360px]:text-[13px]">
                <span className="truncate">{name}</span>
                {creator.verified_badge ? (
                  <IoCheckmarkCircle className="shrink-0 text-primary" size={15} aria-label="Verified" />
                ) : null}
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-0.5 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:gap-x-3">
                <p className="truncate text-[11px] font-semibold text-muted min-[360px]:text-[12px] sm:text-[13px]">
                  {loc}
                </p>
                <p className="truncate text-[11px] font-semibold text-muted min-[360px]:text-[12px] sm:text-[13px]">
                  {when}
                </p>
              </div>
              <p className="mt-1 text-[13px] font-extrabold text-primary min-[360px]:text-[14px]">
                {price ?? 'Open price'}
              </p>
            </div>
            <IoChevronForward
              size={18}
              className="mt-0.5 shrink-0 text-muted/50 sm:hidden"
              aria-hidden
            />
          </div>
        </Link>

        <div className="flex shrink-0 items-center border-l border-primary/10 px-2 py-2 min-[360px]:px-2.5 sm:px-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onUnsave();
            }}
            disabled={unsaving}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              'bg-gradient-to-br from-primary/15 to-secondary/15 text-primary transition hover:opacity-90',
              'min-[360px]:h-11 min-[360px]:w-11 min-[360px]:rounded-2xl',
              unsaving && 'opacity-50'
            )}
            aria-label="Remove from saved"
          >
            <IoBookmark className="h-5 w-5 min-[360px]:h-[22px] min-[360px]:w-[22px]" />
          </button>
        </div>
      </div>
    </article>
  );
}
