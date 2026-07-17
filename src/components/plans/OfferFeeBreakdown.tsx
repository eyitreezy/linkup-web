'use client';

import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { grossAmountCents, platformFeeCentsForAmount } from '@/lib/plans/planFinancialConfig';
import { cn } from '@/utils/cn';

type Props = {
  budgetCents: number;
  showDivider?: boolean;
  className?: string;
};

export function OfferFeeBreakdown({ budgetCents, showDivider = true, className }: Props) {
  if (!budgetCents || budgetCents <= 0) return null;

  const feeCents = platformFeeCentsForAmount(budgetCents);
  const totalGross = grossAmountCents(budgetCents);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-muted">Platform fee (5%)</span>
        <span className="font-extrabold text-[#059669]">+ {formatNGN(feeCents)}</span>
      </div>

      {showDivider ? <div className="border-t border-primary/15" /> : null}

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-extrabold text-foreground">Total you pay</span>
        <span className="text-[14px] font-extrabold text-foreground">{formatNGN(totalGross)}</span>
      </div>
    </div>
  );
}
