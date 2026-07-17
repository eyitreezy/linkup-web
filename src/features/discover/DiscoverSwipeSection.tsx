'use client';

import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { DiscoverSwipeActionButtons } from '@/features/discover/DiscoverSwipeActionButtons';
import type { DiscoverSwipeDeckRef } from '@/features/discover/DiscoverSwipeDeck';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';
import type { PlanFeedRow } from '@/services/plans.service';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const DiscoverSwipeDeck = dynamic(
  () => import('@/features/discover/DiscoverSwipeDeck').then((m) => ({ default: m.DiscoverSwipeDeck })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[min(72vh,520px)] w-full animate-pulse rounded-2xl bg-[#EDE8FF]/60" aria-hidden />
    ),
  }
);

type Props = {
  plans: PlanFeedRow[];
  moodCount: number;
  presenceFor: (creatorId: string, prefs: PlanFeedRow['creator']) => PresenceUi | null;
  distanceLabelFor: (plan: PlanFeedRow) => string;
  filterKey: string;
  onHidePlan: (planId: string) => void;
  onUndoHidden: () => void;
  canUndoSwipe: boolean;
};

export function DiscoverSwipeSection({
  plans,
  moodCount,
  presenceFor,
  distanceLabelFor,
  filterKey,
  onHidePlan,
  onUndoHidden,
  canUndoSwipe,
}: Props) {
  const router = useRouter();
  const runGated = useGatedAction();
  const deckRef = useRef<DiscoverSwipeDeckRef>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [filterKey, plans.length]);

  useEffect(() => {
    if (index >= plans.length && plans.length > 0) setIndex(0);
  }, [index, plans.length]);

  const openPlan = useCallback(
    (plan: PlanFeedRow) => {
      router.push(`/plan/${plan.id}`);
    },
    [router]
  );

  const onSwipeRight = useCallback(
    (plan: PlanFeedRow) => {
      openPlan(plan);
    },
    [openPlan]
  );

  const onSwipeLeft = useCallback(
    (plan: PlanFeedRow) => {
      onHidePlan(plan.id);
    },
    [onHidePlan]
  );

  const current = plans[index];

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/20 bg-white/80 px-4 py-8 text-center">
        {canUndoSwipe ? (
          <>
            <p className="font-display text-lg font-extrabold text-foreground">All passed for now</p>
            <p className="mt-2 text-[14px] font-semibold text-muted">
              Undo passes or switch to grid to see plans again this session.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full border border-primary/30 px-4 py-2 text-[13px] font-extrabold text-primary"
              onClick={() => {
                void runGated('discover.undo_swipe', onUndoHidden);
              }}
            >
              Undo passes
            </button>
          </>
        ) : (
          <p className="text-[14px] font-semibold text-muted">
            {moodCount > 0
              ? 'Swipe mood moments above — this deck is for longer meetup ideas.'
              : 'No standard plans in this vibe. Try another filter or check back soon.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <DiscoverSwipeDeck
        ref={deckRef}
        items={plans}
        index={index}
        onIndexChange={setIndex}
        distanceLabelFor={distanceLabelFor}
        presenceFor={(p) => presenceFor(p.creator_id, p.creator)}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
        onPressCard={openPlan}
      />
      <DiscoverSwipeActionButtons
        disabled={!current}
        onPass={() => deckRef.current?.swipeLeft()}
        onLike={() => deckRef.current?.swipeRight()}
        onInfo={() => {
          if (current) openPlan(current);
        }}
      />
    </div>
  );
}
