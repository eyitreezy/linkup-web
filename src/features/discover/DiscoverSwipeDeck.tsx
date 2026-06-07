'use client';

import { DiscoverSwipeCard } from '@/features/discover/DiscoverSwipeCard';
import type { PresenceUi } from '@/lib/presence/hostPresenceStatus';
import type { PlanFeedRow } from '@/services/plans.service';
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { IoClose, IoHeart } from 'react-icons/io5';

const SWIPE_THRESHOLD = 110;
const TILT_DEG = 12;

/** Min deck height when flex parent is ambiguous (mobile web). */
const DECK_MIN_H = 300;

export type DiscoverSwipeDeckRef = {
  swipeLeft: () => void;
  swipeRight: () => void;
};

type Props = {
  items: PlanFeedRow[];
  index: number;
  onIndexChange: (next: number) => void;
  distanceLabelFor: (plan: PlanFeedRow) => string;
  presenceFor: (plan: PlanFeedRow) => PresenceUi | null;
  onSwipeRight: (plan: PlanFeedRow) => void;
  onSwipeLeft: (plan: PlanFeedRow) => void;
  onPressCard: (plan: PlanFeedRow) => void;
};

export const DiscoverSwipeDeck = forwardRef<DiscoverSwipeDeckRef, Props>(function DiscoverSwipeDeck(
  { items, index, onIndexChange, distanceLabelFor, presenceFor, onSwipeRight, onSwipeLeft, onPressCard },
  ref
) {
  const top = items[index] ?? null;
  const next = items[index + 1] ?? null;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-TILT_DEG, TILT_DEG]);
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [index, top?.id, x, y]);

  const advance = useCallback(() => {
    onIndexChange(index + 1);
  }, [index, onIndexChange]);

  const flyOut = useCallback(
    async (dir: 'left' | 'right') => {
      if (!top || animating) return;
      setAnimating(true);
      const target = dir === 'right' ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
      await animate(x, target, { duration: 0.28, ease: [0.32, 0.72, 0, 1] });
      if (dir === 'right') onSwipeRight(top);
      else onSwipeLeft(top);
      x.set(0);
      y.set(0);
      advance();
      setAnimating(false);
    },
    [top, animating, x, y, onSwipeRight, onSwipeLeft, advance]
  );

  useImperativeHandle(
    ref,
    () => ({
      swipeLeft: () => void flyOut('left'),
      swipeRight: () => void flyOut('right'),
    }),
    [flyOut]
  );

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (animating || !top) return;
      if (info.offset.x > SWIPE_THRESHOLD) void flyOut('right');
      else if (info.offset.x < -SWIPE_THRESHOLD) void flyOut('left');
      else {
        void animate(x, 0, { type: 'spring', stiffness: 220, damping: 22 });
        void animate(y, 0, { type: 'spring', stiffness: 220, damping: 22 });
      }
    },
    [animating, top, flyOut, x, y]
  );

  if (!top) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-4xl">✨</p>
        <p className="mt-3 font-display text-xl font-extrabold text-foreground">You&apos;re all caught up</p>
        <p className="mt-2 max-w-xs text-[15px] font-semibold leading-relaxed text-muted">
          Switch to grid view or pull to refresh for more meetup ideas nearby.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-1 sm:px-2">
      <div
        className="relative w-full flex-1"
        style={{ minHeight: DECK_MIN_H }}
      >
        {next ? (
          <div className="pointer-events-none absolute inset-0 scale-[0.96] opacity-[0.92]">
            <DiscoverSwipeCard
              plan={next}
              distanceLabel={distanceLabelFor(next)}
              presence={presenceFor(next)}
              className="h-full min-h-[300px]"
            />
          </div>
        ) : null}

        <motion.div
          key={top.id}
          className="absolute inset-0 z-[2] touch-pan-y"
          style={{ x, y, rotate }}
          drag={animating ? false : 'x'}
          dragElastic={0.9}
          dragMomentum={false}
          onDrag={(_, info) => {
            y.set(info.offset.y * 0.35);
          }}
          onDragEnd={onDragEnd}
          onTap={() => {
            if (!animating) onPressCard(top);
          }}
          whileTap={{ cursor: 'grabbing' }}
        >
          <DiscoverSwipeCard
            plan={top}
            distanceLabel={distanceLabelFor(top)}
            presence={presenceFor(top)}
            className="h-full min-h-[300px]"
          />

          <motion.div
            className="pointer-events-none absolute right-4 top-[38%] z-10 flex flex-col items-center rounded-2xl border-[3px] border-secondary bg-white/95 px-4 py-3 shadow-lg"
            style={{ opacity: likeOpacity }}
          >
            <IoHeart size={42} className="text-secondary" />
            <span className="mt-1 text-[13px] font-extrabold text-secondary">Into it</span>
          </motion.div>

          <motion.div
            className="pointer-events-none absolute left-4 top-[38%] z-10 flex flex-col items-center rounded-2xl border-[3px] border-border bg-white/95 px-4 py-3 shadow-lg"
            style={{ opacity: passOpacity }}
          >
            <IoClose size={40} className="text-foreground" />
            <span className="mt-1 text-[13px] font-extrabold text-foreground">Pass</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
});
