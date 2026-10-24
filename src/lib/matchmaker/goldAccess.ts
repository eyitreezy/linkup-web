import type { SubscriptionState } from '@/lib/subscription/types';

/** Mirrors `matchmaker_user_has_gold_access` for client-side UI (banner, resume trigger). */
export function hasMatchMakerGoldAccess(state: SubscriptionState): boolean {
  const tier = state.effectiveTier;
  return tier === 'GOLD' || tier === 'PLATINUM';
}
