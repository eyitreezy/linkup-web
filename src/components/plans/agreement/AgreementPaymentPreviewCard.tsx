import {
  formatEscrowMoney,
  patternLabel,
  type AgreementPaymentPreview,
} from '@/lib/escrow/escrowPaymentPreview';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import {
  budgetFromGrossAmountCents,
  feeFromGrossAmountCents,
} from '@/lib/plans/planFinancialConfig';
import type { EscrowPattern } from '@/types/database';
import { IoWalletOutline } from 'react-icons/io5';

type Variant = 'you_pay_next' | 'counterparty_pays' | 'split_you_pay' | 'split_waiting';

type Props = {
  preview: AgreementPaymentPreview;
  variant: Variant;
  /** Gross amount from escrow.amount_cents for the current viewer's payment leg. */
  grossCents?: number | null;
  isGroupSplit?: boolean;
};

function bodyForVariant(preview: AgreementPaymentPreview, variant: Variant): string {
  const { currency, userPaysCents, counterpartyPaysCents, totalCents } = preview;
  const yours = formatEscrowMoney(userPaysCents, currency);
  const theirs = formatEscrowMoney(counterpartyPaysCents, currency);
  const total = formatEscrowMoney(totalCents, currency);

  if (variant === 'counterparty_pays') {
    return `No charge on this screen. ${theirs} will be held in escrow on the next screen once your guest completes checkout. Total commitment: ${total}.`;
  }
  if (variant === 'split_waiting') {
    return `You've confirmed your share. We're waiting for ${theirs} from your guest on the escrow screen. Total held when complete: ${total}.`;
  }
  return '';
}

function PatternChip({ pattern }: { pattern: EscrowPattern }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary">
      {patternLabel(pattern)}
    </span>
  );
}

function payerContextNote(isGroupSplit: boolean, isSplitPlan: boolean): string {
  if (isGroupSplit) {
    return 'Once you pay, your slot is secured. The plan activates when all parties have funded their shares.';
  }
  if (isSplitPlan) {
    return 'Both shares must be funded before the plan goes active.';
  }
  return 'Your payment is held securely in escrow until the meetup is confirmed.';
}

export function AgreementPaymentPreviewCard({
  preview,
  variant,
  grossCents,
  isGroupSplit = false,
}: Props) {
  const isPayerVariant = variant === 'you_pay_next' || variant === 'split_you_pay';
  const isSplitPlan = preview.pattern === 'B' && !isGroupSplit;
  const gross = grossCents != null && grossCents > 0 ? grossCents : null;
  const budgetCents = gross != null ? budgetFromGrossAmountCents(gross) : 0;
  const feeCents = gross != null ? feeFromGrossAmountCents(gross) : 0;

  const counterpartyAmount =
    variant === 'counterparty_pays' ? preview.counterpartyPaysCents : preview.userPaysCents;
  const payerHeadline = gross != null ? formatNGN(gross) : null;
  const counterpartyHeadline = formatEscrowMoney(counterpartyAmount, preview.currency);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-white p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IoWalletOutline size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Next screen</p>
          <p className="text-[16px] font-extrabold text-foreground">
            {variant === 'counterparty_pays'
              ? `Guest pays ${counterpartyHeadline}`
              : payerHeadline
                ? `You'll pay ${payerHeadline}`
                : "You'll pay on the next screen"}
          </p>
        </div>
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        {!isGroupSplit ? <PatternChip pattern={preview.pattern} /> : null}
        <span className="text-[12px] font-semibold text-muted">· Flutterwave · held in escrow</span>
      </div>

      {isPayerVariant && gross != null ? (
        <>
          <div className="relative mt-3 space-y-1.5 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-muted">Your plan contribution</span>
              <span className="font-extrabold text-foreground">{formatNGN(budgetCents)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-muted">Platform fee (5%)</span>
              <span className="font-extrabold text-[#059669]">+ {formatNGN(feeCents)}</span>
            </div>
            <div className="border-t border-primary/15" />
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-extrabold text-foreground">Total to Flutterwave</span>
              <span className="font-extrabold text-foreground">{formatNGN(gross)}</span>
            </div>
          </div>
          <p className="relative mt-2 text-[14px] font-semibold leading-relaxed text-muted">
            {payerContextNote(isGroupSplit, isSplitPlan)}
          </p>
        </>
      ) : (
        <p className="relative mt-3 text-[14px] font-semibold leading-relaxed text-muted">
          {bodyForVariant(preview, variant)}
        </p>
      )}
    </section>
  );
}
