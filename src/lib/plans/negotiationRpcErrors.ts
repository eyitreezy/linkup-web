export function formatNegotiationRpcError(message: string): string {
  const m = message.trim();
  if (m.includes('not_your_turn')) return "It's not your turn to respond yet.";
  if (m.includes('not_authenticated')) return 'Sign in to continue.';
  if (m.includes('not_plan_host')) return 'Only the host can respond to this offer.';
  if (m.includes('not_offer_owner')) return 'Only the guest who sent this offer can respond.';
  if (m.includes('offer_not_found')) return 'This offer is no longer available.';
  if (m.includes('cannot_counter')) return 'You cannot counter at this stage.';
  if (m.includes('counter_amount_required')) return 'Enter a counter amount.';
  if (m.includes('invalid_action')) return 'That action is not allowed right now.';
  if (m.includes('invalid_guest_amount')) {
    return 'This offer has no share amount and the plan has no suggested share to use. Ask the guest to include an amount.';
  }
  return m;
}
