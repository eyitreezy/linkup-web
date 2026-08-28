export const MIN_ESCROW_NGN = 7_000;
export const MAX_ESCROW_TIER1_NGN = 5_000_000;

export const MIN_ESCROW_CENTS = MIN_ESCROW_NGN * 100;
export const MAX_ESCROW_TIER1_CENTS = MAX_ESCROW_TIER1_NGN * 100;

/** Flat 5% platform fee on all plan budget amounts (500 basis points). */
export const PLATFORM_FEE_BPS = 500;

/** Goodwill credits can offset at most 50% of the platform fee. */
export const GOODWILL_MAX_FEE_OFFSET_PCT = 50;

export function platformFeeBpsForAmountCents(_amountCents: number): number {
  return PLATFORM_FEE_BPS;
}

/** Platform fee from a plan budget amount (kobo). */
export function platformFeeCentsForAmount(budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  return Math.round((budgetCents * PLATFORM_FEE_BPS) / 10_000);
}

/** Gross escrow amount stored at creation: budget + fee. */
export function grossAmountCents(budgetCents: number): number {
  return budgetCents + platformFeeCentsForAmount(budgetCents);
}

/** Budget portion embedded in a gross escrow amount. */
export function budgetFromGrossAmountCents(grossCents: number): number {
  if (grossCents <= 0) return 0;
  return Math.round(grossCents / 1.05);
}

/** Fee portion embedded in a gross escrow amount. */
export function feeFromGrossAmountCents(grossCents: number): number {
  return grossCents - budgetFromGrossAmountCents(grossCents);
}

type PatternBLegEscrowFields = {
  amount_cents: number;
  host_share_cents?: number | null;
  guest_share_cents?: number | null;
};

/** Gross checkout amount for one pattern B leg (single-leg rows use share columns). */
export function patternBLegGrossCents(
  escrow: PatternBLegEscrowFields,
  leg: 'host' | 'guest'
): number {
  const hostBudget = Math.max(0, escrow.host_share_cents ?? 0);
  const guestBudget = Math.max(0, escrow.guest_share_cents ?? 0);

  if (leg === 'host' && hostBudget > 0) {
    return grossAmountCents(hostBudget);
  }
  if (leg === 'guest' && guestBudget > 0) {
    return grossAmountCents(guestBudget);
  }

  return Math.max(0, escrow.amount_cents ?? 0);
}

type EscrowLegCheckoutFields = {
  escrow_pattern?: string | null;
  amount_cents?: number | null;
  host_share_cents?: number | null;
  guest_share_cents?: number | null;
  host_id?: string | null;
  guest_id?: string | null;
};

/** Plan contribution (budget) for the viewer's payment leg on an escrow row. */
export function resolveEscrowLegBudgetCents(
  escrow: EscrowLegCheckoutFields,
  userId: string
): number {
  const pattern = escrow.escrow_pattern ?? 'A';
  const hostShare = Math.max(0, escrow.host_share_cents ?? 0);
  const guestShare = Math.max(0, escrow.guest_share_cents ?? 0);
  const isHost = userId === escrow.host_id;
  const isGuest = userId === escrow.guest_id;

  if (pattern === 'B') {
    if (isGuest && guestShare > 0) return guestShare;
    if (isHost && hostShare > 0) return hostShare;
    if (guestShare > 0 && hostShare <= 0) return guestShare;
    if (hostShare > 0 && guestShare <= 0) return hostShare;
  }

  const amount = Math.max(0, escrow.amount_cents ?? 0);
  return amount > 0 ? budgetFromGrossAmountCents(amount) : 0;
}

/** Gross checkout total for the viewer's payment leg. */
export function resolveEscrowLegGrossCents(
  escrow: EscrowLegCheckoutFields,
  userId: string
): number {
  const budget = resolveEscrowLegBudgetCents(escrow, userId);
  if (budget <= 0) return Math.max(0, escrow.amount_cents ?? 0);
  if ((escrow.escrow_pattern ?? 'A') === 'B') {
    return grossAmountCents(budget);
  }
  return Math.max(0, escrow.amount_cents ?? 0);
}

/** Fee breakdown for the viewer's payment leg (contribution + 5% fee = total). */
export function resolveEscrowLegFeeBreakdown(
  escrow: EscrowLegCheckoutFields,
  userId: string
): { budgetCents: number; feeCents: number; grossCents: number } {
  const budgetCents = resolveEscrowLegBudgetCents(escrow, userId);
  if (budgetCents <= 0) {
    return { budgetCents: 0, feeCents: 0, grossCents: 0 };
  }
  const feeCents = platformFeeCentsForAmount(budgetCents);
  return { budgetCents, feeCents, grossCents: budgetCents + feeCents };
}

/** Max goodwill offset for a given full fee amount. */
export function goodwillMaxOffsetCents(feeCents: number): number {
  if (feeCents <= 0) return 0;
  return Math.floor((feeCents * GOODWILL_MAX_FEE_OFFSET_PCT) / 100);
}

export function formatPlatformFeeDisplay(budgetCents: number): {
  feeCents: number;
  grossCents: number;
  feePercentLabel: string;
} {
  const feeCents = platformFeeCentsForAmount(budgetCents);
  return {
    feeCents,
    grossCents: budgetCents + feeCents,
    feePercentLabel: '5%',
  };
}
