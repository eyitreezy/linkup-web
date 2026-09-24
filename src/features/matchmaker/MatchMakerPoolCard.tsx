'use client';

import { MatchMakerPoolGridCard } from '@/features/matchmaker/MatchMakerPoolGridCard';
import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';

type Props = {
  profile: PoolProfileRow;
  preview?: boolean;
  signals?: string[];
  onPass?: () => void;
  onExpressInterest?: () => void;
  expressBusy?: boolean;
};

/** @deprecated Prefer MatchMakerPoolGridCard or MatchMakerPoolListCard. */
export function MatchMakerPoolCard({
  profile,
  preview = false,
  signals = [],
  onPass,
  onExpressInterest,
  expressBusy = false,
}: Props) {
  return (
    <MatchMakerPoolGridCard
      profile={profile}
      preview={preview}
      signals={signals}
      onPass={onPass}
      onExpressInterest={onExpressInterest}
      expressBusy={expressBusy}
    />
  );
}
