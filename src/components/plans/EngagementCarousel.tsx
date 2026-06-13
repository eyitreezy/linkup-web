'use client';

import type { EngagementCarouselItem } from '@/lib/plans/fetchFeedEngagementCarousel';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoChevronForward } from 'react-icons/io5';

type Props = {
  items: EngagementCarouselItem[];
  loading?: boolean;
};

function CardSkeleton() {
  return (
    <div className="h-[148px] w-[min(82vw,292px)] shrink-0 animate-pulse rounded-[20px] border border-primary/10 bg-[#EDE8FF]/60 min-[360px]:w-[292px]" />
  );
}

function EngagementCard({ item }: { item: EngagementCarouselItem }) {
  const href =
    item.navigateTo === 'agreement' ? `/plan/${item.planId}/agreement` : `/plan/${item.planId}`;

  return (
    <Link
      href={href}
      className="block w-[min(82vw,292px)] shrink-0 rounded-[20px] border border-primary/10 bg-white p-4 shadow-[0_6px_14px_rgba(108,99,255,0.1)] transition hover:border-primary/25 hover:shadow-[0_8px_20px_rgba(108,99,255,0.14)] min-[360px]:w-[292px]"
    >
      <div className="flex gap-3">
        {item.otherAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.otherAvatarUrl}
            alt=""
            className="h-[52px] w-[52px] shrink-0 rounded-full border-2 border-primary/15 object-cover"
          />
        ) : (
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#EDE8FF] text-[17px] font-extrabold text-primary">
            {item.otherName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-foreground">{item.otherName}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-muted">
            {item.planTitle}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary">
          {item.engagementLabel}
        </span>
        <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-extrabold text-secondary">
          {item.statusLabel}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[14px] font-extrabold text-primary">
        {item.navigateTo === 'agreement' ? 'View' : 'Continue'}
        <IoChevronForward size={16} />
      </div>
    </Link>
  );
}

export function EngagementCarousel({ items, loading }: Props) {
  const showSkeleton = !!loading && items.length === 0;
  if (!showSkeleton && items.length === 0) return null;

  return (
    <section className="min-w-0 space-y-2 min-[360px]:space-y-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted min-[360px]:text-[11px]">
        Your activity
      </p>
      <div
        className={cn(
          '-mx-0.5 flex gap-3 overflow-x-auto pb-1 scrollbar-none',
          showSkeleton && 'min-h-[148px]'
        )}
      >
        {showSkeleton
          ? [0, 1, 2].map((i) => <CardSkeleton key={i} />)
          : items.map((item) => <EngagementCard key={item.key} item={item} />)}
      </div>
    </section>
  );
}
