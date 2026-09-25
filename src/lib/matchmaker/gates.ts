export type MatchMakerGate =
  | 'subscription'
  | 'kyc'
  | 'cooldown'
  | 'suspended'
  | 'gender_not_set'
  | 'intent'
  | 'values'
  | 'connection'
  | 'open'
  | 'pool';

export type MatchMakerGateState = {
  gate: MatchMakerGate;
  connection_id?: string;
  connection_status?: string;
  cooldown_until?: string;
  suspension_until?: string;
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
    default:
      return null;
  }
}
