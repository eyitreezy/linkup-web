'use client';

import { MoodPlanDiscoverPill } from '@/features/discover/MoodPlanDiscoverPill';
import type { PlanFeedRow } from '@/services/plans.service';
import { cn } from '@/utils/cn';

type Props = {
  plans: PlanFeedRow[];
  className?: string;
  viewerUserId?: string;
};

export function MoodTimelineCarousel({ plans, className, viewerUserId }: Props) {
  if (plans.length === 0) return null;

  return (
    <section className={cn('min-w-0 space-y-2 min-[360px]:space-y-3', className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-secondary min-[360px]:text-[11px]">
          Live mood lane
        </p>
        <h2 className="font-display text-base font-extrabold text-foreground min-[360px]:text-lg">Mood timeline</h2>
        <div className="mt-1.5 h-[3px] w-10 rounded-full linkup-gradient-primary min-[360px]:mt-2 min-[360px]:w-12" />
        <p className="mt-1.5 text-[12px] font-semibold text-muted min-[360px]:mt-2 min-[360px]:text-[13px]">
          Swipe live mood moments — tap a card to open the plan.
        </p>
      </div>
      <div className="-mx-0.5 flex gap-2.5 overflow-x-auto pb-2 scrollbar-none min-[360px]:-mx-1 min-[360px]:gap-3">
        {plans.map((plan) => (
          <div key={plan.id} className="w-[min(82vw,300px)] shrink-0 min-[360px]:w-[min(88vw,340px)] sm:w-[340px]">
            <MoodPlanDiscoverPill plan={plan} viewerUserId={viewerUserId} />
          </div>
        ))}
      </div>
    </section>
  );
}
