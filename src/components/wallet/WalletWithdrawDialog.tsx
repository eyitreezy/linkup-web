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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [account, setAccount] = useState(savedAccount);

  if (!open) return null;

  const maxNgn = Math.floor(balanceCents / 100);
  const parsedNgn = Number.parseInt(amountInput.replace(/\D/g, ''), 10);
  const amountCents =
    Number.isFinite(parsedNgn) && parsedNgn > 0 ? Math.min(parsedNgn, maxNgn) * 100 : balanceCents;

  async function handleWithdraw() {
    if (!account) {
      setShowAddAccount(true);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await invokeDisburseWallet({
        amountCents,
        paymentAccountId: account.id,
      });
      if (!result.success) {
        setError(result.error ?? 'Withdrawal failed');
        return;
      }
      setSuccessMsg('Withdrawal initiated. We will notify you when your bank receives the funds.');
      onSuccess();
    } catch {
      setError('Withdrawal failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="linkup-card flex w-full min-w-0 max-w-md flex-col rounded-2xl p-4 shadow-xl min-[425px]:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-extrabold text-foreground">Withdraw to bank</h2>

        {showAddAccount || !account ? (
          <div className="mt-4">
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
          </div>
        ) : (
          <>
            <p className="mt-2 text-[14px] font-semibold text-muted">
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
            {successMsg ? (
              <p className="mt-3 text-[13px] font-semibold text-emerald-700">{successMsg}</p>
            ) : null}

            <button
              type="button"
              disabled={busy || balanceCents < 100 || !!successMsg}
              onClick={() => void handleWithdraw()}
              className={cn(
                'mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
              )}
            >
              {busy ? 'Processing…' : `Withdraw ${formatNGN(amountCents)}`}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
