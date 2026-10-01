import type { MatchMakerGateState } from '@/lib/matchmaker/gates';

export type MatchMakerLifecyclePhase = 'none' | 'reflection' | 'healing' | 'reentry';

export type MatchMakerLifecycleInfo = {
  phase: MatchMakerLifecyclePhase;
  reflectionDay?: number;
  healingDay?: number;
  daysUntilPool?: number;
  reflectionStartedAt?: string;
  sourceConnectionId?: string;
};

export function lifecycleFromGateState(state: MatchMakerGateState): MatchMakerLifecycleInfo | null {
  const gate = state.gate;
  if (gate !== 'reflection' && gate !== 'healing' && gate !== 'reentry') return null;
  return {
    phase: gate,
    reflectionDay: state.reflection_day,
    healingDay: state.healing_day,
    daysUntilPool: state.days_until_pool,
    reflectionStartedAt: state.reflection_started_at,
    sourceConnectionId: state.source_connection_id,
  };
}

export function gateRedirectForLifecycle(gate: MatchMakerGateState['gate']): string | null {
  switch (gate) {
    case 'reflection':
      return '/matchmaker/reflect';
    case 'healing':
      return '/matchmaker/heal';
    case 'reentry':
      return '/matchmaker/reentry';
    case 'cooldown':
      return '/matchmaker/cooldown';
    default:
      return null;
  }
}
