export type MatchMakerGate =
  | 'subscription'
  | 'kyc'
  | 'cooldown'
  | 'suspended'
  | 'gender_not_set'
  | 'intent'
  | 'values'
  | 'connection'
  | 'reflection'
  | 'healing'
  | 'reentry'
  | 'open'
  | 'pool';

export type MatchMakerGateState = {
  gate: MatchMakerGate;
  connection_id?: string;
  connection_status?: string;
  cooldown_until?: string;
  suspension_until?: string;
  cooldown_reason?: string;
  reflection_day?: number;
  healing_day?: number;
  days_until_pool?: number;
  reflection_started_at?: string;
  source_connection_id?: string;
};

/** Redirect only for onboarding/connection flows — not for gate modals. */
export function gateRedirectPath(state: MatchMakerGateState): string | null {
  switch (state.gate) {
    case 'intent':
      return '/matchmaker/declare';
    case 'values':
      return '/matchmaker/values';
    case 'connection':
      return state.connection_id ? `/matchmaker/connection/${state.connection_id}` : '/matchmaker';
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
