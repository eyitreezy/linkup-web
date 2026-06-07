'use client';

import { DiscoverSwipeActionButtons } from '@/features/discover/DiscoverSwipeActionButtons';
import { DiscoverSwipeDeck, type DiscoverSwipeDeckRef } from '@/features/discover/DiscoverSwipeDeck';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';
import type { PlanFeedRow } from '@/services/plans.service';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HIDDEN_KEY = 'linkup_discover_hidden_plans';

function loadHidden(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveHidden(ids: Set<string>) {
  try {
    sessionStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

type Props = {
  plans: PlanFeedRow[];
  moodCount: number;
  presenceFor: (creatorId: string, prefs: PlanFeedRow['creator']) => PresenceUi | null;
  distanceLabelFor: (plan: PlanFeedRow) => string;
  filterKey: string;
};

export function DiscoverSwipeSection({
  plans,
  moodCount,
  presenceFor,
  distanceLabelFor,
  filterKey,
}: Props) {
  const router = useRouter();
  const deckRef = useRef<DiscoverSwipeDeckRef>(null);
  const [index, setIndex] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadHidden());

  const items = useMemo(() => plans.filter((p) => !hiddenIds.has(p.id)), [plans, hiddenIds]);

  useEffect(() => {
    setIndex(0);
  }, [filterKey, plans.length]);

  useEffect(() => {
    if (index >= items.length && items.length > 0) setIndex(0);
  }, [index, items.length]);

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

  const onSwipeLeft = useCallback((plan: PlanFeedRow) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(plan.id);
      saveHidden(next);
      return next;
    });
  }, []);

  const current = items[index];

  if (plans.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-primary/20 bg-white/80 px-4 py-8 text-center text-[14px] font-semibold text-muted">
        {moodCount > 0
          ? 'Swipe mood moments above — this deck is for longer meetup ideas.'
          : 'No standard plans in this vibe. Try another filter or check back soon.'}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/20 bg-white/80 px-4 py-8 text-center">
        <p className="font-display text-lg font-extrabold text-foreground">All passed for now</p>
        <p className="mt-2 text-[14px] font-semibold text-muted">
          Refresh the feed or switch to grid to see plans again this session.
        </p>
        <button
          type="button"
          className="mt-4 rounded-full border border-primary/30 px-4 py-2 text-[13px] font-extrabold text-primary"
          onClick={() => {
            setHiddenIds(new Set());
            saveHidden(new Set());
            setIndex(0);
          }}
        >
          Show passed plans again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <DiscoverSwipeDeck
        ref={deckRef}
        items={items}
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
