'use client';

import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { platformFeeCentsForAmount } from '@/lib/plans/planFinancialConfig';
import { IoCheckmarkCircleOutline, IoInformationCircleOutline } from 'react-icons/io5';

export function PlanBudgetFeeNotifier({
  budgetCents,
  participantCount,
  isGroupPlan,
}: {
  budgetCents: number;
  participantCount: number;
  isGroupPlan: boolean;
}) {
  if (!budgetCents || budgetCents <= 0) return null;

  const feeCents = platformFeeCentsForAmount(budgetCents);
  const grossCents = budgetCents + feeCents;
  const perPersonGross =
    isGroupPlan && participantCount > 1 ? Math.ceil(grossCents / participantCount) : grossCents;
  const perPersonBudget =
    isGroupPlan && participantCount > 1 ? Math.ceil(budgetCents / participantCount) : budgetCents;
  const perPersonFee = perPersonGross - perPersonBudget;

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-primary/15 bg-[#EDE8FF]/40 p-4">
      <div className="flex items-center gap-2">
        <IoInformationCircleOutline className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm font-extrabold text-foreground">How the plan budget is shared</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-muted">Plan budget</span>
          <span className="font-extrabold text-foreground">{formatNGN(budgetCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-muted">Platform fee (5%)</span>
          <span className="font-extrabold text-[#059669]">+ {formatNGN(feeCents)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-primary/15 pt-1.5 text-sm">
          <span className="font-extrabold text-foreground">Total</span>
          <span className="font-extrabold text-foreground">{formatNGN(grossCents)}</span>
        </div>
      </div>

      {isGroupPlan && participantCount > 1 ? (
        <p className="text-xs font-semibold leading-relaxed text-primary">
          {`With ${participantCount} participants, each person contributes `}
          <strong className="font-extrabold text-foreground">{formatNGN(perPersonGross)}</strong>
          {` (${formatNGN(perPersonBudget)} plan share + ${formatNGN(perPersonFee)} fee).`}
        </p>
      ) : null}

      <div className="flex items-start gap-1.5">
        <IoCheckmarkCircleOutline className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" />
        <p className="text-xs font-semibold leading-relaxed text-muted">
          {`You receive your full ${formatNGN(budgetCents)} budget after the meetup is confirmed.`}
        </p>
      </div>
    </div>
  );
}
