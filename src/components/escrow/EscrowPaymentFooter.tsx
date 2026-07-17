'use client';

import { EscrowFundCTA } from '@/components/escrow/EscrowFundCTA';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoCheckmarkCircle, IoHourglassOutline, IoSparklesOutline } from 'react-icons/io5';

export const ESCROW_FOOTER_CLEARANCE = 'pb-[10.5rem]';

type PaymentConfirmedCopy = {
  title: string;
  message: string;
};

type Props = {
  showFund: boolean;
  fundTitle: string;
  fundSubtitle: string;
  onFundPress: () => void;
  fundDisabled?: boolean;
  fundLoading?: boolean;
  paymentPendingConfirmation?: boolean;
  showPaymentConfirmedFooter?: boolean;
  paymentConfirmedCopy?: PaymentConfirmedCopy;
  confirmationTimeout?: boolean;
  secondsElapsed?: number;
  checkAgainBusy?: boolean;
  onCheckAgain?: () => void;
  planId?: string;
  className?: string;
};

export function EscrowPaymentFooter({
  showFund,
  fundTitle,
  fundSubtitle,
  onFundPress,
  fundDisabled,
  fundLoading,
  paymentPendingConfirmation,
  showPaymentConfirmedFooter,
  paymentConfirmedCopy,
  confirmationTimeout,
  secondsElapsed = 0,
  checkAgainBusy,
  onCheckAgain,
  planId,
  className,
}: Props) {
  const showFooter =
    showFund || paymentPendingConfirmation || showPaymentConfirmedFooter;

  if (!showFooter) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[60] border-t border-border/60 bg-white/95 backdrop-blur-sm',
        className
      )}
      role="region"
      aria-label="Payment actions"
    >
      <div className="mx-auto max-w-3xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {showFund ? (
          <EscrowFundCTA
            title={fundTitle}
            subtitle={fundSubtitle}
            onPress={onFundPress}
            disabled={fundDisabled}
            loading={fundLoading}
          />
        ) : showPaymentConfirmedFooter && paymentConfirmedCopy ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <IoCheckmarkCircle size={40} className="text-emerald-600" />
            <p className="font-display text-lg font-extrabold text-foreground">{paymentConfirmedCopy.title}</p>
            <p className="text-[14px] font-semibold leading-relaxed text-muted">{paymentConfirmedCopy.message}</p>
            {planId ? (
              <Link
                href={`/plan/${planId}`}
                className="mt-1 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full border-2 border-transparent bg-gradient-to-r from-primary to-secondary p-[2px]"
              >
                <span className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-extrabold text-primary">
                  <IoSparklesOutline size={18} />
                  Return to plan
                </span>
              </Link>
            ) : null}
          </div>
        ) : confirmationTimeout ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <IoHourglassOutline size={40} className="text-amber-500" />
            <p className="font-display text-lg font-extrabold text-foreground">Taking longer than expected</p>
            <p className="text-[14px] font-semibold leading-relaxed text-muted">
              Your payment was received by Flutterwave. We&apos;re still waiting for the confirmation to
              reach us. This can occasionally take a minute.
            </p>
            <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => onCheckAgain?.()}
                disabled={checkAgainBusy}
                className="flex-1 rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white disabled:opacity-50"
              >
                {checkAgainBusy ? 'Checking…' : 'Check again'}
              </button>
              {planId ? (
                <Link
                  href={`/plan/${planId}`}
                  className="flex flex-1 items-center justify-center rounded-full border border-primary/25 py-3 text-[14px] font-extrabold text-primary"
                >
                  Return to plan
                </Link>
              ) : null}
            </div>
          </div>
        ) : paymentPendingConfirmation ? (
          <div className="flex items-start gap-3">
            <div className="mt-1 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <div>
              <p className="font-display text-[15px] font-extrabold text-foreground">
                Confirming payment with escrow
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
                Your Flutterwave payment is being applied.
                {secondsElapsed > 8
                  ? ' This is taking a moment. Please wait.'
                  : ' This usually takes a few seconds.'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
