import { derivePlanViewerContext, type PlanViewerContext } from '@/lib/plans/planViewerContext';
import type { PlanGuestEscrowSnapshot } from '@/lib/plans/planPayShare';
import type { DbPlan, DbPlanOffer, DbEscrowTransaction, JoinRequestStatus } from '@/types/database';
import { useMemo } from 'react';

export type { PlanViewerContext, PlanLockState, AcceptedGuestRef } from '@/lib/plans/planViewerContext';
export {
  derivePlanViewerContext,
  findMyLatestOffer,
  listAcceptedGuests,
  acceptedGuestCount,
  computePlanLockState,
} from '@/lib/plans/planViewerContext';

export function usePlanViewerContext(
  plan: DbPlan | null,
  currentUserId: string | undefined,
  offers: DbPlanOffer[],
  opts?: {
    listingExpired?: boolean;
    /** @deprecated Use listingExpired */
    moodClosed?: boolean;
    completionSelfAcked?: boolean;
    myJoinRequest?: { id: string; status: JoinRequestStatus } | null;
    myGuestEscrow?: PlanGuestEscrowSnapshot | null;
    myHostEscrow?: PlanGuestEscrowSnapshot | null;
    approvedJoinRequestCount?: number;
    groupGuestEscrows?: Array<
      Pick<
        DbEscrowTransaction,
        'guest_id' | 'guest_share_cents' | 'amount_cents' | 'status' | 'guest_funded_at'
      >
    >;
  }
): PlanViewerContext | null {
  return useMemo(() => {
    if (!plan) return null;
    return derivePlanViewerContext(plan, currentUserId, offers, opts);
  }, [
    plan,
    currentUserId,
    offers,
    opts?.listingExpired,
    opts?.moodClosed,
    opts?.completionSelfAcked,
    opts?.myJoinRequest,
    opts?.myGuestEscrow,
    opts?.myHostEscrow,
    opts?.approvedJoinRequestCount,
    opts?.groupGuestEscrows,
  ]);
}
