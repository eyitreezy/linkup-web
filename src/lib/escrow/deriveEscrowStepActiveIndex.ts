/** Last completed step index (0=Agree … 3=Done). Current step is activeIndex + 1. */
export function deriveEscrowStepActiveIndex(input: {
  escrowStatus: string;
  planStatus: string | null | undefined;
  escrowFullyFundedForMeet: boolean;
  hostViewingGuestLeg?: boolean;
}): number {
  const { escrowStatus, planStatus, escrowFullyFundedForMeet, hostViewingGuestLeg } = input;

  if (escrowStatus === 'released') return 3;

  if (planStatus === 'completed' && escrowFullyFundedForMeet) return 2;

  if (planStatus === 'active' && escrowFullyFundedForMeet) return 1;

  if (hostViewingGuestLeg) {
    return planStatus === 'active' ? 1 : 0;
  }

  if (escrowStatus === 'funded' || escrowStatus === 'active') {
    return planStatus === 'active' ? 1 : 0;
  }

  return 0;
}
