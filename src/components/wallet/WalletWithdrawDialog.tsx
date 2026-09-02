'use client';

import { RefundAccountForm } from '@/components/escrow/RefundAccountForm';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { maskAccountNumber } from '@/lib/escrow/virtualAccountPayment';
import { invokeDisburseWallet } from '@/lib/wallet/disburseWallet';
import type { DbUserPaymentAccount } from '@/types/database';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  balanceCents: number;
  savedAccount: DbUserPaymentAccount | null;
  onAccountSaved: (account: DbUserPaymentAccount) => void;
  onSuccess: () => void;
};

export function WalletWithdrawDialog({
  open,
  onOpenChange,
  userId,
  balanceCents,
  savedAccount,
  onAccountSaved,
  onSuccess,
}: Props) {
  const [amountInput, setAmountInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number>(0);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [account, setAccount] = useState(savedAccount);

  if (!open) return null;

  const maxNgn = Math.floor(balanceCents / 100);
  const parsedNgn = Number.parseInt(amountInput.replace(/\D/g, ''), 10);
  const amountCents =
    Number.isFinite(parsedNgn) && parsedNgn > 0
      ? Math.min(parsedNgn, maxNgn) * 100
      : balanceCents;
  const withdrawDisabled =
    busy || balanceCents < 100 || showSuccess || amountCents < 100;

  async function handleWithdraw() {
    if (!account) {
      setShowAddAccount(true);
      return;
    }
    if (balanceCents < 100) {
      setError('Your available balance is too low to withdraw.');
      return;
    }
    if (amountCents < 100) {
      setError('Enter an amount up to your available balance.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await invokeDisburseWallet({
        amountCents,
        paymentAccountId: account.id,
      });

      const transferSucceeded =
        result.success || !!result.disbursement_id || !!result.transfer_ref;

      if (transferSucceeded) {
        setSuccessAmount(result.amount_cents ?? amountCents);
        setShowSuccess(true);
        onSuccess();
      } else {
        setError(result.error ?? 'Withdrawal failed. Please try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-withdraw-title"
        onClick={() => onOpenChange(false)}
      >
        <div
          className="linkup-card flex max-h-[min(calc(100dvh-1.5rem),720px)] w-full min-w-0 max-w-md flex-col overflow-hidden rounded-2xl p-4 shadow-xl min-[425px]:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="wallet-withdraw-title" className="shrink-0 font-display text-lg font-extrabold text-foreground">
            Withdraw to bank
          </h2>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {showAddAccount || !account ? (
              <RefundAccountForm
                userId={userId}
                savedAccount={account}
                submitLabel="Save bank account"
                allowOneTime={false}
                onComplete={async (result) => {
                  if (result.mode !== 'saved') return;
                  const { fetchSavedPaymentAccount } = await import('@/lib/escrow/virtualAccountPayment');
                  const saved = await fetchSavedPaymentAccount(userId);
                  if (saved) {
                    setAccount(saved);
                    onAccountSaved(saved);
                    setShowAddAccount(false);
                  }
                }}
              />
            ) : (
              <>
                <p className="text-[14px] font-semibold text-muted">
                  {account.bank_name} · {maskAccountNumber(account.account_number)}
                </p>
                <p className="text-[13px] font-semibold text-foreground">{account.account_name}</p>

                <label className="mt-4 block text-[13px] font-extrabold text-foreground">
                  Amount (NGN)
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-[15px] font-semibold"
                    placeholder={String(maxNgn)}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                  />
                </label>
                <p className="mt-1 text-[12px] font-semibold text-muted">
                  Available: {formatNGN(balanceCents)}
                </p>

                {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

                <button
                  type="button"
                  disabled={withdrawDisabled}
                  onClick={() => void handleWithdraw()}
                  className={cn(
                    'mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
                  )}
                >
                  {busy ? 'Processing…' : `Withdraw ${formatNGN(amountCents)}`}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-3 flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50"
          >
            Close
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="font-display text-[22px] font-extrabold text-foreground">
              Withdrawal successful
            </h2>
            <p className="mt-2 text-[14px] font-semibold text-muted">
              {successAmount > 0
                ? `${formatNGN(successAmount)} has been sent to your bank account.`
                : 'Your withdrawal has been processed successfully.'}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-muted">
              Allow 1 to 3 business days for the funds to reflect.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowSuccess(false);
                onOpenChange(false);
              }}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-full linkup-gradient-primary px-6 text-[15px] font-extrabold text-white transition hover:opacity-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
