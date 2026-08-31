'use client';

import { PlanDetailScreen } from '@/features/plans/PlanDetailScreen';
import { parsePlanDetailFrom, type PlanDetailFrom } from '@/lib/plans/planDetailNavigation';
import { useSearchParams } from 'next/navigation';

type Props = {
  planId: string;
  currentUserId: string;
};

/** Isolates useSearchParams so the plan detail page can SSR safely inside Suspense. */
export function PlanDetailRouteClient({ planId, currentUserId }: Props) {
  const searchParams = useSearchParams();
  const planDetailFrom: PlanDetailFrom | null = parsePlanDetailFrom(searchParams.get('from'));

  return (
    <PlanDetailScreen planId={planId} currentUserId={currentUserId} planDetailFrom={planDetailFrom} />
  );
}
