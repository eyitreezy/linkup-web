import { OfferFeeBreakdown } from '@/components/plans/OfferFeeBreakdown';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import {
  planTotalAmountCents,
  remainingGuestSlots,
} from '@/lib/plans/groupDynamicSplit';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import type { DbPlan } from '@/types/database';

type Props = {
  plan: Pick<
    DbPlan,
    | 'current_suggested_share_cents'
    | 'total_amount_cents'
    | 'starting_price_cents'
    | 'max_guests'
    | 'accepted_guest_count'
  >;
};

export function GroupSuggestedShareAnchor({ plan }: Props) {
  const suggested = plan.current_suggested_share_cents;
  if (suggested == null || suggested <= 0) return null;

  const slots = remainingGuestSlots(plan);
  const total = planTotalAmountCents(plan);

  return (
    <div className="linkup-card space-y-1 border-primary/10 bg-[#F5F6FA]/80 p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Suggested share</p>
      <p className="font-display text-2xl font-extrabold text-foreground">
        {formatNGN(grossAmountCents(suggested))}
      </p>
      <p className="text-[12px] font-semibold leading-relaxed text-muted">
        Based on {slots} remaining slot{slots === 1 ? '' : 's'} and a plan total of {formatNGN(total)}
      </p>

      <div className="mt-2 flex items-center justify-between border-t border-primary/15 pt-2">
        <span className="text-[12px] font-semibold text-muted">Plan contribution</span>
        <span className="text-[12px] font-extrabold text-foreground">{formatNGN(suggested)}</span>
      </div>

      <OfferFeeBreakdown budgetCents={suggested} showDivider={false} className="mt-1" />
    </div>
  );
}
