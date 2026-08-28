'use client';

import { EscrowPaymentSuccessModal } from '@/components/escrow/EscrowPaymentSuccessModal';
import { EscrowScreenHeader } from '@/components/escrow/EscrowScreenHeader';
import { RefundAccountForm, type RefundAccountResult } from '@/components/escrow/RefundAccountForm';
import { OfferFeeBreakdown } from '@/components/plans/OfferFeeBreakdown';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import {
  resolveBankTransferBudgetCents,
  resolveBankTransferPayAmountCents,
} from '@/lib/escrow/escrowFundingUi';
import { escrowUserPaymentVerified } from '@/lib/escrow/escrowFundingStatus';
import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import {
  confirmSandboxBankTransfer,
  fetchNigerianBanks,
  generateVirtualAccount,
  syncEscrowFromVirtualAccount,
} from '@/lib/escrow/virtualAccountPayment';
import { createClient } from '@/lib/supabase/client';
import type { DbEscrowTransaction, DbUserPaymentAccount } from '@/types/database';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCheckmarkCircle, IoCopyOutline, IoTimeOutline } from 'react-icons/io5';

type VirtualAccountState = {
  sessionId: string;
  accountNumber: string;
  bankName: string;
  amountCents: number;
  expiresAt: string;
};

type Props = {
  escrow: Pick<
    DbEscrowTransaction,
    | 'id'
    | 'amount_cents'
    | 'plan_id'
    | 'status'
    | 'escrow_pattern'
    | 'host_id'
    | 'guest_id'
    | 'payer_id'
    | 'host_funded_at'
    | 'guest_funded_at'
    | 'host_share_cents'
    | 'guest_share_cents'
  >;
  savedAccount: DbUserPaymentAccount | null;
  currentUserId: string;
  escrowLeg?: 'host' | 'guest';
  agreementPlanId?: string;
};

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const SANDBOX_TRANSFER_HINT =
  'Test mode: Flutterwave Mock Bank does not detect real transfers. Use the button below to confirm your test payment after reviewing the amount.';

function isSandboxBankName(bankName: string | null | undefined): boolean {
  const name = (bankName ?? '').trim().toLowerCase();
  return name.includes('mock') || name.includes('test') || name === 'virtual bank';
}

const ESCROW_FUNDING_SELECT =
  'id, status, escrow_pattern, host_id, guest_id, payer_id, host_funded_at, guest_funded_at, amount_cents, host_share_cents, guest_share_cents, metadata';

export function BankTransferClient({
  escrow,
  savedAccount,
  currentUserId,
  escrowLeg,
  agreementPlanId,
}: Props) {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [step, setStep] = useState<'refund_account' | 'virtual_account'>('refund_account');
  const [va, setVa] = useState<VirtualAccountState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdownMs, setCountdownMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [manualCheckBusy, setManualCheckBusy] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const fundedRef = useRef(false);
  const vaSessionIdRef = useRef<string | null>(null);

  const isSandboxTransfer = sandboxMode || (va ? isSandboxBankName(va.bankName) : false);

  const payAmountCents = useMemo(
    () => resolveBankTransferPayAmountCents(escrow, currentUserId, escrowLeg),
    [escrow, currentUserId, escrowLeg]
  );
  const budgetCents = useMemo(
    () => resolveBankTransferBudgetCents(escrow, currentUserId, escrowLeg),
    [escrow, currentUserId, escrowLeg]
  );
  const displayAmountCents = payAmountCents > 0 ? payAmountCents : (va?.amountCents ?? 0);

  const backHref = agreementPlanId ? `/escrow/${escrow.id}?planId=${agreementPlanId}` : `/escrow/${escrow.id}`;
  const successHref = agreementPlanId
    ? `/plan/${escrow.plan_id}/agreement?planId=${agreementPlanId}`
    : `/plan/${escrow.plan_id}/agreement`;

  const handleFunded = useCallback(() => {
    if (fundedRef.current) return;
    fundedRef.current = true;
    setShowSuccess(true);
  }, []);

  const runFundingCheck = useCallback(async () => {
    const { data } = await client
      .from('escrow_transactions')
      .select(ESCROW_FUNDING_SELECT)
      .eq('id', escrow.id)
      .maybeSingle();
    if (data && escrowUserPaymentVerified(data as DbEscrowTransaction, currentUserId)) {
      handleFunded();
      return true;
    }
    return false;
  }, [client, currentUserId, escrow.id, handleFunded]);

  const checkFundingStatus = useCallback(async () => {
    return runFundingCheck();
  }, [runFundingCheck]);

  useEffect(() => {
    void fetchNigerianBanks()
      .then((result) => setSandboxMode(result.sandboxMode))
      .catch(() => setSandboxMode(false));
  }, []);

  async function onConfirmTransferSent() {
    setError(null);
    setManualCheckBusy(true);
    try {
      const sessionId = vaSessionIdRef.current;
      if (!sessionId) {
        setError('Payment session not found. Generate a new account and try again.');
        return;
      }

      if (isSandboxTransfer) {
        const confirmed = await confirmSandboxBankTransfer(client, escrow.id, sessionId);
        if (confirmed) {
          handleFunded();
          return;
        }
        const funded = await runFundingCheck();
        if (funded) return;
        setError('Could not confirm your test payment. Try again.');
        return;
      }

      await syncEscrowFromVirtualAccount(client, escrow.id);
      const funded = await runFundingCheck();
      if (!funded) {
        setError(
          'Payment not detected yet. It can take a minute. We will keep checking automatically.'
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check payment status');
    } finally {
      setManualCheckBusy(false);
    }
  }

  function handleSuccessContinue() {
    router.replace(successHref);
  }

  useEffect(() => {
    if (step !== 'virtual_account' || !va) return;

    const tick = () => {
      const remaining = new Date(va.expiresAt).getTime() - Date.now();
      setCountdownMs(remaining);
      setIsExpired(remaining <= 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, va]);

  useEffect(() => {
    vaSessionIdRef.current = va?.sessionId ?? null;
  }, [va?.sessionId]);

  useEffect(() => {
    if (step !== 'virtual_account' || showSuccess) return;

    void checkFundingStatus();

    if (isSandboxTransfer) return;

    const poll = setInterval(() => {
      void checkFundingStatus();
    }, 5000);

    return () => clearInterval(poll);
  }, [checkFundingStatus, isSandboxTransfer, showSuccess, step]);

  useEffect(() => {
    if (step !== 'virtual_account') return;

    return subscribeEscrowRealtime({
      escrowId: escrow.id,
      planId: escrow.plan_id,
      onRefresh: () => {
        void checkFundingStatus();
      },
    });
  }, [checkFundingStatus, escrow.id, escrow.plan_id, step]);

  useEffect(() => {
    if (step !== 'virtual_account') return;

    const channel = client
      .channel(`va-session-${escrow.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'virtual_account_sessions',
          filter: `escrow_id=eq.${escrow.id}`,
        },
        () => {
          void checkFundingStatus();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [checkFundingStatus, client, escrow.id, step]);

  async function onRefundComplete(result: RefundAccountResult) {
    setBusy(true);
    setError(null);
    try {
      const params =
        result.mode === 'saved'
          ? { escrowId: escrow.id, escrowLeg, refundAccountId: result.accountId, expectedAmountCents: payAmountCents }
          : {
              escrowId: escrow.id,
              escrowLeg,
              oneTimeRefundBankCode: result.bankCode,
              oneTimeRefundAccountNumber: result.accountNumber,
              oneTimeRefundAccountName: result.accountName,
              expectedAmountCents: payAmountCents,
            };
      const session = await generateVirtualAccount(params);
      vaSessionIdRef.current = session.session_id;
      const grossCents = payAmountCents > 0 ? payAmountCents : session.amount_cents;
      setVa({
        sessionId: session.session_id,
        accountNumber: session.account_number,
        bankName: session.bank_name,
        amountCents: grossCents,
        expiresAt: session.expires_at,
      });
      setStep('virtual_account');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate virtual account');
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate() {
    fundedRef.current = false;
    setShowSuccess(false);
    setVa(null);
    vaSessionIdRef.current = null;
    setStep('refund_account');
    setIsExpired(false);
  }

  async function onCopy() {
    if (!va) return;
    try {
      await navigator.clipboard.writeText(va.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy account number');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <EscrowScreenHeader backHref={backHref} />

      <section className="linkup-card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full linkup-gradient-primary" aria-hidden />
        <div className="pl-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Bank transfer</p>
          <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {showSuccess ? 'Payment received' : step === 'refund_account' ? 'Refund account' : 'Transfer payment'}
          </h1>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
            {showSuccess
              ? 'Your transfer was received. Continue to view your updated agreement status.'
              : step === 'refund_account'
                ? 'We need your bank details in case a refund is required.'
                : 'Send the exact amount to the account below. Your escrow confirms automatically once received.'}
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
          {error}
        </p>
      ) : null}

      {copied ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <IoCheckmarkCircle size={20} />
          <span className="text-[14px] font-extrabold">Copied!</span>
        </div>
      ) : null}

      {showSuccess ? (
        <section className="linkup-card space-y-4 border-emerald-200 bg-emerald-50/80 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <IoCheckmarkCircle size={28} className="shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-display text-lg font-extrabold text-emerald-900">Payment confirmed</p>
              <p className="mt-1 text-[14px] font-semibold leading-relaxed text-emerald-800">
                Your bank transfer has been received and your escrow leg is funded.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSuccessContinue}
            className="w-full rounded-full linkup-gradient-primary py-3.5 text-[15px] font-extrabold text-white"
          >
            Continue
          </button>
        </section>
      ) : null}

      {!showSuccess && step === 'refund_account' ? (
        <RefundAccountForm
          userId={currentUserId}
          savedAccount={savedAccount}
          onComplete={onRefundComplete}
          busy={busy}
        />
      ) : null}

      {!showSuccess && va ? (
        <>
          {isSandboxTransfer ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[13px] font-semibold leading-relaxed text-amber-900">{SANDBOX_TRANSFER_HINT}</p>
            </section>
          ) : null}

          <section className="linkup-card space-y-4 p-5 sm:p-6">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Transfer payment to</p>

            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold text-muted">Bank</p>
                <p className="text-[15px] font-semibold text-foreground">{va.bankName}</p>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-muted">Account number</p>
                <div className="mt-1 flex items-center gap-3">
                  <p className="font-display text-2xl font-extrabold tracking-wide text-primary">
                    {va.accountNumber}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onCopy()}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 text-primary transition hover:bg-[#EDE8FF]/60"
                    aria-label="Copy account number"
                  >
                    <IoCopyOutline size={18} />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-muted">Exact amount</p>
                <p className="font-display text-lg font-extrabold text-primary">{formatNGN(displayAmountCents)}</p>
                {budgetCents > 0 ? (
                  <div className="mt-3 rounded-xl border border-primary/10 bg-[#F8F7FF]/60 p-3">
                    <OfferFeeBreakdown budgetCents={budgetCents} />
                  </div>
                ) : null}
              </div>

              {!isExpired && !showSuccess && !isSandboxTransfer ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-[#F8F7FF]/40 px-3 py-2.5">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  <p className="text-[13px] font-semibold text-muted">
                    Waiting for your transfer. We check automatically every few seconds.
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <IoTimeOutline size={18} className={isExpired ? 'text-[#EF4444]' : 'text-muted'} />
                {isExpired ? (
                  <p className="text-[14px] font-extrabold text-[#EF4444]">Account expired</p>
                ) : (
                  <p className="text-[14px] font-semibold text-muted">
                    Expires in{' '}
                    <span className="font-extrabold tabular-nums text-foreground">{formatCountdown(countdownMs)}</span>
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="linkup-card space-y-2 p-5">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Important</p>
            <ul className="space-y-2 text-[14px] font-semibold leading-relaxed text-muted">
              <li>Transfer the exact amount shown above.</li>
              <li>Only transfer from the account you provided.</li>
              <li>Your escrow will be confirmed automatically once payment is received.</li>
            </ul>
          </section>

          {isExpired ? (
            <button
              type="button"
              onClick={() => void onRegenerate()}
              className={cn(
                'w-full rounded-full border border-primary/25 bg-white py-4 text-[16px] font-extrabold text-primary transition hover:bg-[#F8F7FF]'
              )}
            >
              Generate new account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onConfirmTransferSent()}
              disabled={manualCheckBusy || busy}
              className={cn(
                'w-full rounded-full linkup-gradient-primary py-4 text-[16px] font-extrabold text-white transition',
                (manualCheckBusy || busy) && 'opacity-70'
              )}
            >
              {manualCheckBusy
                ? isSandboxTransfer
                  ? 'Confirming test payment...'
                  : 'Checking payment...'
                : isSandboxTransfer
                  ? 'Confirm test payment'
                  : "I've sent the transfer"}
            </button>
          )}
        </>
      ) : null}

      {showSuccess ? (
        <EscrowPaymentSuccessModal
          message="Your bank transfer has been received and your escrow has been funded."
          onContinue={handleSuccessContinue}
        />
      ) : null}
    </div>
  );
}
