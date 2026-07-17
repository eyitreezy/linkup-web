'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { offerAgreedAmountCents } from '@/lib/plans/groupDynamicSplit';
import type { DbPlanOffer } from '@/types/database';

type EscrowRow = {
  status: string;
  payer_id?: string | null;
  host_id?: string | null;
  guest_id?: string | null;
  funded_at?: string | null;
  host_funded_at?: string | null;
  guest_funded_at?: string | null;
};

type Props = {
  offer: DbPlanOffer;
  escrow?: EscrowRow | null;
  displayName: string;
  avatarUrl: string | null;
};

export function GroupSplitGuestSlotRow({ offer, escrow, displayName, avatarUrl }: Props) {
  const amount = offerAgreedAmountCents(offer);
  const funded =
    (escrow?.status != null && ['funded', 'active', 'released'].includes(escrow.status)) ||
    !!escrow?.funded_at ||
    !!escrow?.host_funded_at ||
    !!escrow?.guest_funded_at;
  const badgeStatus = funded ? 'funded' : (escrow?.status ?? 'pending_funding');

  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <AvatarWithPresence uri={avatarUrl} name={displayName} size={36} presence={null} showDot={false} />
        <p className="truncate text-[14px] font-extrabold text-foreground">{displayName}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="text-[14px] font-extrabold text-foreground">{formatNGN(amount)}</p>
        <EscrowStatusBadge status={badgeStatus} />
      </div>
    </div>
  );
}
