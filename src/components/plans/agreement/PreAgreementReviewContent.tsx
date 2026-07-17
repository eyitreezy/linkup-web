'use client';

import { CancellationPolicyRows } from '@/components/plans/CancellationPolicyRows';
import { CANCELLATION_POLICY_TABLE_ROWS } from '@/lib/plans/cancellationPolicy';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import {
  budgetFromGrossAmountCents,
  feeFromGrossAmountCents,
} from '@/lib/plans/planFinancialConfig';
import { cn } from '@/utils/cn';
import { IoCheckmark } from 'react-icons/io5';
import {
  IoCalendarOutline,
  IoLockClosedOutline,
  IoPricetagOutline,
  IoServerOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

export type PreAgreementReviewProps = {
  planTitle: string;
  whenLabel: string;
  locationLabel: string | null;
  priceLabel: string;
  /** Gross amount from escrow.amount_cents for the viewer's payment leg. */
  userPayGrossCents: number | null;
  currencyLabel: string;
  agreed?: boolean;
  onAgreedChange?: (agreed: boolean) => void;
  patternCardTitle?: string | null;
  patternCardBody?: string | null;
  showPaymentPreview?: boolean;
  isGroupSplit?: boolean;
  isSplitPlan?: boolean;
};

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="linkup-card space-y-3 border-primary/10 p-5 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
      <div className="flex items-center gap-2">
        <Icon className="text-primary" size={18} />
        <h3 className="font-display text-lg font-extrabold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-primary/10 py-3 first:border-t-0 first:pt-0">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="text-right text-[14px] font-extrabold text-foreground">{value}</span>
    </div>
  );
}

export function PreAgreementReviewContent({
  planTitle,
  whenLabel,
  locationLabel,
  priceLabel,
  userPayGrossCents,
  currencyLabel,
  agreed = false,
  onAgreedChange,
  patternCardTitle,
  patternCardBody,
  showPaymentPreview = true,
  isGroupSplit = false,
  isSplitPlan = false,
}: PreAgreementReviewProps) {
  const grossCents = userPayGrossCents != null && userPayGrossCents > 0 ? userPayGrossCents : 0;
  const budgetCents = grossCents > 0 ? budgetFromGrossAmountCents(grossCents) : 0;
  const feeCents = grossCents > 0 ? feeFromGrossAmountCents(grossCents) : 0;
  const sym = currencyLabel === 'NGN' ? '₦' : `${currencyLabel} `;
  const formatMoney = (cents: number) =>
    currencyLabel === 'NGN' ? formatNGN(cents) : `${sym}${Math.round(cents / 100).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <SectionCard title="Plan summary" icon={IoCalendarOutline}>
        <p className="font-display text-xl font-extrabold text-foreground">{planTitle}</p>
        <DetailRow label="When" value={whenLabel} />
        {locationLabel ? <DetailRow label="Location" value={locationLabel} /> : null}
        <DetailRow label="Agreed price" value={priceLabel} />
      </SectionCard>

      <SectionCard title="Escrow" icon={IoLockClosedOutline}>
        {grossCents > 0 ? (
          <>
            <DetailRow label="Plan budget" value={formatMoney(budgetCents)} />
            {patternCardTitle && patternCardBody ? (
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-[13px] font-extrabold text-primary">{patternCardTitle}</p>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">{patternCardBody}</p>
              </div>
            ) : (
              <p className="text-[13px] font-semibold leading-relaxed text-muted">
                Funds are protected with escrow and released per plan rules after the meetup.
              </p>
            )}
            {showPaymentPreview ? (
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-[13px] font-extrabold text-primary">After you confirm</p>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
                  {`The next screen opens secure payment via Flutterwave. You'll pay ${formatMoney(grossCents)} (${formatMoney(budgetCents)} plan contribution + ${formatMoney(feeCents)} platform fee). Nothing is charged on this review screen.`}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[14px] font-semibold text-muted">No escrow for this free plan.</p>
        )}
      </SectionCard>

      <SectionCard title="Fees (estimate)" icon={IoPricetagOutline}>
        {grossCents > 0 ? (
          <>
            <DetailRow label="Your plan contribution" value={formatMoney(budgetCents)} />
            <DetailRow label="Platform fee (5%)" value={`+ ${formatMoney(feeCents)}`} />
            <DetailRow label="Total you pay" value={formatMoney(grossCents)} />
            <p className="text-[12px] font-semibold text-muted">
              {isGroupSplit
                ? 'Once you pay, your slot is secured. The plan activates when all parties have funded their shares.'
                : isSplitPlan
                  ? 'Both shares must be funded before the plan goes active.'
                  : 'Your payment is held securely in escrow until the meetup is confirmed.'}
            </p>
          </>
        ) : (
          <p className="text-[14px] font-semibold text-muted">No platform fee on free plans.</p>
        )}
      </SectionCard>

      <SectionCard title="Cancellation policy" icon={IoShieldCheckmarkOutline}>
        <p className="text-[13px] font-semibold leading-relaxed text-muted">
          Role- and timing-based rules, calculated from meetup time vs when someone cancels in-app.
        </p>
        <CancellationPolicyRows rows={CANCELLATION_POLICY_TABLE_ROWS} dense />
        <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
          <IoServerOutline className="mt-0.5 shrink-0 text-primary" size={16} />
          <p className="text-[12px] font-semibold leading-relaxed text-muted">
            Outcomes are enforced on LinkUp servers after escrow funding and are not editable in chat.
          </p>
        </div>
      </SectionCard>

      {onAgreedChange ? (
        <label className="linkup-card flex cursor-pointer select-none items-start gap-3 border-primary/10 p-5 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            onClick={() => onAgreedChange(!agreed)}
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-150',
              agreed ? 'linkup-gradient-primary text-white shadow-sm' : 'border-2 border-primary/35 bg-white'
            )}
          >
            {agreed ? <IoCheckmark size={15} aria-hidden /> : null}
          </button>
          <span className="text-[14px] font-semibold leading-relaxed text-foreground">
            I have read this summary and agree to the plan and policy.
          </span>
        </label>
      ) : null}
    </div>
  );
}
