'use client';

import { planHeroUri } from '@/lib/plans/planHero';
import type { PlanFeedRow } from '@/services/plans.service';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  plan: PlanFeedRow;
  className?: string;
};

export function PlanCardHero({ plan, className }: Props) {
  const hero = planHeroUri(plan);
  const [failed, setFailed] = useState(false);
  const showImage = hero && !failed;

  return (
    <div
      className={cn(
        'relative h-40 w-full overflow-hidden bg-gradient-to-br from-[#EDE8FF] to-[#FFF5F8]',
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- host photos may be any storage origin
        <img
          src={hero}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <svg
            className="h-10 w-10 text-white/70"
            viewBox="0 0 512 512"
            fill="currentColor"
            aria-hidden
          >
            <path d="M432 48H80c-17.67 0-32 14.33-32 32v336c0 17.67 14.33 32 32 32h352c17.67 0 32-14.33 32-32V80c0-17.67-14.33-32-32-32zm-96 224c-35.35 0-64-28.65-64-64s28.65-64 64-64 64 28.65 64 64-28.65 64-64 64z" />
          </svg>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}
