import { isGroupSplitPlan } from '@/lib/plans/groupDynamicSplit';
import type { DbPlan, DbPlanOffer } from '@/types/database';

/** Plan has moved past open negotiation (1:1 or group slot agreed). */
export function planIsPastNegotiation(status: string): boolean {
  return (
    status === 'agreed' ||
    status === 'awaiting_payment' ||
    status === 'active' ||
    status === 'completed'
  );
}

type PlanSlice = Pick<DbPlan, 'id' | 'is_group_plan' | 'accepted_offer_id'>;

/** Resolve the accepted offer id to pass into the agreement screen (1:1 host/guest + group slots). */
export function resolveAgreementOfferId(
  plan: Pick<DbPlan, 'accepted_offer_id'>,
  userId: string | undefined,
  offers: DbPlanOffer[],
  explicitOfferId?: string | null
): string | undefined {
  if (explicitOfferId) return explicitOfferId;
  if (userId) {
    const userAccepted = offers.find((o) => o.bidder_id === userId && o.status === 'accepted');
    if (userAccepted) return userAccepted.id;
  }
  if (plan.accepted_offer_id) {
    const matched = offers.find((o) => o.id === plan.accepted_offer_id && o.status === 'accepted');
    if (matched) return plan.accepted_offer_id;
    if (offers.length === 0) return plan.accepted_offer_id;
  }
  return offers.find((o) => o.status === 'accepted')?.id;
}

export function resolvePlanAgreementHref(
  plan: PlanSlice,
  opts?: { offerId?: string | null; userId?: string | null; offers?: DbPlanOffer[] }
): string {
  const planId = plan.id;
  const slotId = resolveAgreementOfferId(plan, opts?.userId ?? undefined, opts?.offers ?? [], opts?.offerId);
  if (slotId) return `/plan/${planId}/agreement?offerId=${slotId}`;
  return `/plan/${planId}/agreement`;
}

/** Escrow row the current viewer should open for secure payment (never a guest slot for group-split hosts). */
export function resolveAgreementEscrowId(
  plan: Pick<DbPlan, 'creator_id' | 'is_group_plan' | 'escrow_pattern' | 'host_escrow_id'>,
  userId: string,
  bundle: {
    myEscrow?: { id: string } | null;
    hostEscrow?: { id: string } | null;
    escrowId?: string | null;
  }
): string | null {
  const isHost = plan.creator_id === userId;
  if (isGroupSplitPlan(plan)) {
    if (isHost) {
      return bundle.hostEscrow?.id ?? plan.host_escrow_id ?? null;
    }
    return bundle.myEscrow?.id ?? bundle.escrowId ?? null;
  }
  return bundle.myEscrow?.id ?? bundle.escrowId ?? null;
}

/** Escrow detail URL with optional agreement context for back navigation. */
export function resolveEscrowHref(
  escrowId: string,
  opts?: { planId?: string; offerId?: string | null }
): string {
  const params = new URLSearchParams();
  if (opts?.planId) params.set('planId', opts.planId);
  if (opts?.offerId) params.set('offerId', opts.offerId);
  const q = params.toString();
  return q ? `/escrow/${escrowId}?${q}` : `/escrow/${escrowId}`;
}

/** Back link from escrow when opened from a plan agreement. */
export function resolveEscrowBackHref(opts?: { planId?: string; offerId?: string | null }): string {
  if (opts?.planId) {
    const params = new URLSearchParams();
    if (opts.offerId) params.set('offerId', opts.offerId);
    const q = params.toString();
    return q ? `/plan/${opts.planId}/agreement?${q}` : `/plan/${opts.planId}/agreement`;
  }
  return '/offers';
}

/** Whether the current user should leave negotiate for the agreement screen. */
export function shouldRedirectFromNegotiate(
  plan: Pick<DbPlan, 'id' | 'status' | 'is_group_plan' | 'accepted_offer_id' | 'creator_id'>,
  userId: string | undefined,
  offers: DbPlanOffer[]
): { redirect: boolean; href: string } {
  if (!userId) return { redirect: false, href: '' };

  const userAccepted = offers.find((o) => o.bidder_id === userId && o.status === 'accepted');
  if (plan.is_group_plan && userAccepted) {
    return {
      redirect: true,
      href: resolvePlanAgreementHref(plan, { offerId: userAccepted.id }),
    };
  }

  if (!plan.is_group_plan) {
    const oneToOneAgreed =
      planIsPastNegotiation(plan.status) ||
      (!!plan.accepted_offer_id &&
        offers.some((o) => o.id === plan.accepted_offer_id && o.status === 'accepted'));

    if (oneToOneAgreed) {
      const isParty =
        plan.creator_id === userId ||
        !!userAccepted ||
        offers.some((o) => o.id === plan.accepted_offer_id && o.bidder_id === userId);
      if (isParty) {
        return {
          redirect: true,
          href: resolvePlanAgreementHref(plan, { userId, offers }),
        };
      }
    }
  }

  return { redirect: false, href: '' };
}
