export type MatchMakerGate =
  | 'subscription'
  | 'kyc'
  | 'cooldown'
  | 'intent'
  | 'values'
  | 'connection'
  | 'pool';

export type MatchMakerGateState = {
  gate: MatchMakerGate;
  connection_id?: string;
  connection_status?: string;
  cooldown_until?: string;
};

export function gateRedirectPath(state: MatchMakerGateState): string | null {
  switch (state.gate) {
    case 'subscription':
      return '/subscription';
    case 'kyc':
      return '/kyc';
    case 'cooldown':
      return '/matchmaker/suspended';
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
