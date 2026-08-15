import { discoverPlanTypePill } from '@/lib/plans/discoverPlanType';
import { cn } from '@/utils/cn';

type Props = {
  plan: { is_group_plan?: boolean | null; is_mood_plan?: boolean | null };
  className?: string;
};

export function DiscoverPlanTypePillBadge({ plan, className }: Props) {
  const pill = discoverPlanTypePill(plan);
  if (!pill) return null;

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-extrabold backdrop-blur-sm',
        pill.colorClass,
        className
      )}
    >
      {pill.label}
    </span>
  );
}
