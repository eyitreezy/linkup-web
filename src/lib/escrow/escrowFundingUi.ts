import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import type { DbEscrowTransaction, EscrowPattern } from '@/types/database';

export type EscrowFundingUiState = {
  canFund: boolean;
  payAmountCents: number;
  escrowLeg: 'host' | 'guest' | undefined;
  showSplitCard: boolean;
  showSinglePayerCard: boolean;
  waitingForCounterparty: boolean;
  waitingTitle: string | null;
  waitingSubtitle: string | null;
  fundCtaTitle: string;
  userRole: 'host' | 'guest' | 'other';
};

type EscrowFundingFields = Pick<
  DbEscrowTransaction,
  | 'status'
  | 'escrow_pattern'
  | 'payer_id'
  | 'host_id'
  | 'guest_id'
  | 'amount_cents'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'host_funded_at'
  | 'guest_funded_at'
>;

export function getEscrowFundingUiState(escrow: EscrowFundingFields, userId: string): EscrowFundingUiState {
  const pattern = (escrow.escrow_pattern ?? 'A') as EscrowPattern;
  const pending = escrow.status === 'pending_funding';
  const isHost = userId === escrow.host_id;
  const isGuest = userId === escrow.guest_id;
  const userRole: EscrowFundingUiState['userRole'] = isHost ? 'host' : isGuest ? 'guest' : 'other';

  const idle: EscrowFundingUiState = {
    canFund: false,
    payAmountCents: 0,
    escrowLeg: undefined,
    showSplitCard: false,
    showSinglePayerCard: false,
    waitingForCounterparty: false,
    waitingTitle: null,
    waitingSubtitle: null,
    fundCtaTitle: 'Fund escrow',
    userRole,
  };

  if (!pending) return idle;

  const hostShare = escrow.host_share_cents ?? 0;
  const guestShare = escrow.guest_share_cents ?? 0;

  // Host-only / guest-only legs (e.g. group host top-up after guest removal).
  if (hostShare > 0 && guestShare <= 0 && isHost && !escrow.host_funded_at) {
    return {
      ...idle,
      canFund: true,
      payAmountCents: grossAmountCents(hostShare),
      escrowLeg: 'host',
      showSplitCard: pattern === 'B',
      showSinglePayerCard: pattern !== 'B',
      fundCtaTitle: 'Pay your share',
    };
  }
  if (guestShare > 0 && hostShare <= 0 && isGuest && !escrow.guest_funded_at) {
    return {
      ...idle,
      canFund: true,
      payAmountCents: grossAmountCents(guestShare),
      escrowLeg: 'guest',
      showSplitCard: pattern === 'B',
      showSinglePayerCard: pattern !== 'B',
      fundCtaTitle: 'Pay your share',
    };
  }

  if (pattern === 'B') {
    const hostNeeds = isHost && !escrow.host_funded_at && hostShare > 0;
    const guestNeeds = isGuest && !escrow.guest_funded_at && guestShare > 0;
    const userPaidLeg =
      (isHost && !!escrow.host_funded_at) || (isGuest && !!escrow.guest_funded_at);
    const bothDone = !!escrow.host_funded_at && !!escrow.guest_funded_at;

    if (hostNeeds) {
      return {
        ...idle,
        canFund: true,
        payAmountCents: grossAmountCents(hostShare),
        escrowLeg: 'host',
        showSplitCard: true,
        fundCtaTitle: 'Pay your share',
      };
    }
    if (guestNeeds) {
      return {
        ...idle,
        canFund: true,
        payAmountCents: grossAmountCents(guestShare),
        escrowLeg: 'guest',
        showSplitCard: true,
        fundCtaTitle: 'Pay your share',
      };
    }
    if (userPaidLeg && !bothDone) {
      return {
        ...idle,
        showSplitCard: true,
        waitingForCounterparty: true,
        waitingTitle: 'Waiting for the other person',
        waitingSubtitle:
          "Their share is still pending. You'll both get confirmation when escrow is fully funded.",
      };
    }
    return { ...idle, showSplitCard: true };
  }

  if (pattern === 'A' && isHost) {
    return {
      ...idle,
      canFund: true,
      payAmountCents: escrow.amount_cents,
      showSinglePayerCard: true,
      fundCtaTitle: 'Fund escrow',
    };
  }

  if (pattern === 'C' && isGuest) {
    return {
      ...idle,
      canFund: true,
      payAmountCents: escrow.amount_cents,
      showSinglePayerCard: true,
      fundCtaTitle: 'Pay via Flutterwave',
    };
  }

  if (pattern === 'A' && isGuest) {
    return {
      ...idle,
      showSinglePayerCard: true,
      waitingForCounterparty: true,
      waitingTitle: 'Waiting for host payment',
      waitingSubtitle:
        'The host must complete checkout on this screen before the plan goes active.',
    };
  }

  if (pattern === 'C' && isHost) {
    return {
      ...idle,
      showSinglePayerCard: true,
      waitingForCounterparty: true,
      waitingTitle: 'Waiting for guest payment',
      waitingSubtitle:
        'Your guest must complete checkout on this screen before the plan goes active.',
    };
  }

  return idle;
}
