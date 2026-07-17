import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { MAX_ESCROW_TIER1_CENTS } from '@/lib/plans/planFinancialConfig';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { EscrowPattern } from '@/types/database';
import Link from 'next/link';
import { IoCheckmark, IoDiamondOutline, IoEllipseOutline } from 'react-icons/io5';

type Props = {
  amountCents: number;
  currency: string;
  escrowPattern: EscrowPattern | string | null | undefined;
  userTier: SubscriptionTier | string | undefined;
  userKycTier: number | undefined;
  counterpartyKycTier?: number | null;
};

function ReqRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={
        met
          ? 'flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/80 px-3 py-2.5'
          : 'flex items-center gap-3 rounded-xl border border-border/60 bg-[#F5F6FA] px-3 py-2.5'
      }
    >
      <span
        className={
          met
            ? 'flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white'
            : 'flex h-6 w-6 items-center justify-center text-muted'
        }
      >
        {met ? <IoCheckmark size={14} /> : <IoEllipseOutline size={12} />}
      </span>
      <span className={met ? 'text-[14px] font-bold text-emerald-800' : 'text-[14px] font-semibold text-muted'}>
        {label}
      </span>
    </div>
  );
}

export function HighValueEscrowNoticeCard({
  amountCents,
  currency,
  escrowPattern,
  userTier,
  userKycTier,
  counterpartyKycTier,
}: Props) {
  if (amountCents <= MAX_ESCROW_TIER1_CENTS) return null;

  const hasPlatinum = userTier === 'PLATINUM';
  const hasTier3 = (userKycTier ?? 1) >= 3;
  const patternC = escrowPattern === 'C';
  const counterpartyOk = !patternC || (counterpartyKycTier ?? 1) >= 3;
  const allMet = hasPlatinum && hasTier3 && counterpartyOk;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-white p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/20 via-secondary/10 to-transparent"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl linkup-gradient-primary text-white">
          <IoDiamondOutline size={22} />
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">High-value escrow</p>
          <p className="text-[16px] font-extrabold text-foreground">
            {formatEscrowMoney(amountCents, currency)} commitment
          </p>
        </div>
      </div>
      <p className="relative mt-3 text-[14px] font-semibold leading-relaxed text-muted">
        Amounts above ₦5,000,000 need Platinum membership and advanced identity verification before you can proceed to
        secure payment.
      </p>
      <div className="relative mt-4 space-y-2">
        <ReqRow met={hasPlatinum} label="Platinum membership" />
        <ReqRow met={hasTier3} label="Tier 3 identity verification" />
        {patternC ? <ReqRow met={counterpartyOk} label="Guest Tier 3 verification" /> : null}
      </div>
      {!allMet ? (
        <div className="relative mt-4 flex flex-wrap gap-3">
          {!hasPlatinum ? (
            <Link
              href="/subscription"
              className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white"
            >
              Upgrade to Platinum
            </Link>
          ) : null}
          {!hasTier3 ? (
            <Link
              href="/verification"
              className="rounded-full border border-primary/25 px-5 py-2.5 text-[14px] font-extrabold text-primary"
            >
              Complete verification
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
