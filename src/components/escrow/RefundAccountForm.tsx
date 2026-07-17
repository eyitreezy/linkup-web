'use client';

import { ToggleSwitch } from '@/components/settings/ToggleRow';
import {
  fetchNigerianBanks,
  maskAccountNumber,
  savePaymentAccount,
  verifyBankAccount,
} from '@/lib/escrow/virtualAccountPayment';
import type { DbNigerianBank, DbUserPaymentAccount } from '@/types/database';
import { cn } from '@/utils/cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoCheckmark, IoCheckmarkCircle } from 'react-icons/io5';

export type RefundAccountResult =
  | { mode: 'saved'; accountId: string }
  | {
      mode: 'one_time';
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    };

type Props = {
  userId: string;
  savedAccount: DbUserPaymentAccount | null;
  onComplete: (result: RefundAccountResult) => void | Promise<void>;
  busy?: boolean;
  submitLabel?: string;
  allowOneTime?: boolean;
};

export function RefundAccountForm({
  userId,
  savedAccount,
  onComplete,
  busy = false,
  submitLabel = 'Generate payment account',
  allowOneTime = true,
}: Props) {
  const [useDifferent, setUseDifferent] = useState(!savedAccount);
  const [banks, setBanks] = useState<DbNigerianBank[]>([]);
  const [bankQuery, setBankQuery] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<DbNigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [formBusy, setFormBusy] = useState(false);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [sandboxHint, setSandboxHint] = useState<string | null>(null);
  const bankContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBanksLoading(true);
    setBanksError(null);
    setSandboxHint(null);
    void fetchNigerianBanks()
      .then((result) => {
        setBanks(result.banks);
        setSandboxHint(result.sandboxHint);
        if (result.banks.length === 0) {
          setBanksError('Could not load banks. Please refresh and try again.');
        }
      })
      .catch(() => {
        setBanksError('Could not load banks. Please refresh and try again.');
      })
      .finally(() => setBanksLoading(false));
  }, []);

  useEffect(() => {
    if (!bankOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!bankContainerRef.current?.contains(event.target as Node)) setBankOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [bankOpen]);

  useEffect(() => {
    if (consent) setSaveForFuture(true);
  }, [consent]);

  const filteredBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.bank_name.toLowerCase().includes(q));
  }, [banks, bankQuery]);

  useEffect(() => {
    if (accountNumber.length !== 10 || !selectedBank) {
      setAccountName(null);
      setVerifyError(null);
      return;
    }

    let cancelled = false;
    setVerifying(true);
    setVerifyError(null);
    setAccountName(null);

    void verifyBankAccount(accountNumber, selectedBank.bank_code, selectedBank.bank_name)
      .then((result) => {
        if (cancelled) return;
        setAccountName(result.account_name);
      })
      .catch((e) => {
        if (cancelled) return;
        setVerifyError(
          e instanceof Error
            ? e.message
            : 'Could not verify this account. Please check that the account number belongs to the selected bank and try again.'
        );
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountNumber, selectedBank]);

  async function handleUseSaved() {
    if (!savedAccount) return;
    await onComplete({ mode: 'saved', accountId: savedAccount.id });
  }

  async function handleSubmit(save: boolean) {
    if (!selectedBank || !accountName || accountNumber.length !== 10) return;
    if (save && !consent) return;

    setFormBusy(true);
    try {
      if (save) {
        const saved = await savePaymentAccount({
          userId,
          bankCode: selectedBank.bank_code,
          bankName: selectedBank.bank_name,
          accountNumber,
          accountName,
        });
        await onComplete({ mode: 'saved', accountId: saved.id });
      } else {
        await onComplete({
          mode: 'one_time',
          bankCode: selectedBank.bank_code,
          bankName: selectedBank.bank_name,
          accountNumber,
          accountName,
        });
      }
    } finally {
      setFormBusy(false);
    }
  }

  const off = busy || formBusy;
  const canProceed = !!accountName && accountNumber.length === 10 && consent && !verifying;

  if (savedAccount && !useDifferent) {
    return (
      <div className="space-y-4">
        <div className="linkup-card space-y-2 p-5">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Refund account</p>
          <p className="font-display text-lg font-extrabold text-foreground">{savedAccount.bank_name}</p>
          <p className="text-[15px] font-semibold text-foreground">{savedAccount.account_name}</p>
          <p className="text-[14px] font-semibold text-muted">{maskAccountNumber(savedAccount.account_number)}</p>
          <div className="flex items-center gap-2 text-emerald-700">
            <IoCheckmarkCircle size={18} />
            <span className="text-[13px] font-extrabold">Verified</span>
          </div>
        </div>
        <button
          type="button"
          disabled={off}
          onClick={() => void handleUseSaved()}
          className={cn(
            'w-full rounded-full py-4 text-[17px] font-extrabold text-white shadow-lg transition active:scale-[0.985]',
            off ? 'cursor-not-allowed bg-border text-white/70' : 'linkup-gradient-primary hover:opacity-95'
          )}
        >
          {off ? 'Please wait…' : 'Use this account'}
        </button>
        <button
          type="button"
          disabled={off}
          onClick={() => setUseDifferent(true)}
          className="w-full text-center text-[14px] font-extrabold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          Use a different account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {savedAccount ? (
        <button
          type="button"
          disabled={off}
          onClick={() => setUseDifferent(false)}
          className="text-[14px] font-extrabold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          Back to saved account
        </button>
      ) : null}

      {sandboxHint ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] font-semibold leading-relaxed text-amber-950">
          {sandboxHint}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Bank</p>
        {banksLoading ? (
          <div className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-border bg-[#F8F9FC] px-4 py-3 text-[14px] font-semibold text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            Loading banks…
          </div>
        ) : banksError ? (
          <p className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
            {banksError}
          </p>
        ) : (
        <div ref={bankContainerRef} className="relative">
          <div
            role="combobox"
            aria-expanded={bankOpen}
            className={cn(
              'min-h-[52px] cursor-text rounded-2xl border bg-[#F8F9FC] px-3 py-2 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
              'border-border'
            )}
            onClick={() => setBankOpen(true)}
          >
            {selectedBank ? (
              <p className="px-1 py-1.5 text-[15px] font-semibold text-foreground">{selectedBank.bank_name}</p>
            ) : (
              <p className="px-1 py-1.5 text-[15px] font-semibold text-muted">Select a bank</p>
            )}
          </div>
          {bankOpen ? (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-2xl border border-border bg-white py-1 shadow-lg"
            >
              <li className="sticky top-0 z-10 border-b border-border bg-white px-2 pb-2 pt-1">
                <input
                  type="text"
                  placeholder="Search banks..."
                  value={bankQuery}
                  onChange={(e) => setBankQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold outline-none focus:border-primary/40 placeholder:text-muted/70"
                  autoFocus
                />
              </li>
              {filteredBanks.map((bank) => (
                <li key={bank.bank_code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedBank?.bank_code === bank.bank_code}
                    onClick={() => {
                      setSelectedBank(bank);
                      setBankQuery('');
                      setBankOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-foreground hover:bg-[#F8F7FF]"
                  >
                    {bank.bank_name}
                  </button>
                </li>
              ))}
              {filteredBanks.length === 0 && bankQuery.length > 0 ? (
                <li className="px-4 py-4 text-center text-[14px] font-semibold text-muted">
                  No banks found matching &quot;{bankQuery}&quot;
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        )}
      </div>

      <label className="block space-y-2">
        <span className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Account number</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold outline-none focus:border-primary/40"
          placeholder={sandboxHint ? 'e.g. 0690000032 (test account)' : '10-digit account number'}
        />
      </label>

      <div className="min-h-[28px]">
        {verifying ? (
          <div className="flex items-center gap-2 text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-[14px] font-semibold">Verifying account…</span>
          </div>
        ) : accountName ? (
          <div className="flex items-center gap-2 text-emerald-700">
            <IoCheckmarkCircle size={18} />
            <span className="text-[14px] font-extrabold">{accountName}</span>
          </div>
        ) : verifyError ? (
          <p className="text-[14px] font-semibold text-[#EF4444]">{verifyError}</p>
        ) : null}
      </div>

      {accountName ? (
        <>
          <label className="linkup-card flex cursor-pointer select-none items-start gap-3 border-primary/10 p-4">
            <button
              type="button"
              role="checkbox"
              aria-checked={consent}
              onClick={() => setConsent(!consent)}
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-150',
                consent ? 'linkup-gradient-primary text-white shadow-sm' : 'border-2 border-primary/35 bg-white'
              )}
            >
              {consent ? <IoCheckmark size={15} aria-hidden /> : null}
            </button>
            <span className="text-[14px] font-semibold leading-relaxed text-foreground">
              I agree to LinkUp storing my bank account details for refund processing. I can remove these in
              Settings at any time.
            </span>
          </label>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-foreground">Save for future refunds</p>
            </div>
            <ToggleSwitch checked={saveForFuture} onChange={setSaveForFuture} disabled={!consent} />
          </div>
        </>
      ) : null}

      <button
        type="button"
        disabled={!canProceed || off}
        onClick={() => void handleSubmit(saveForFuture && consent)}
        className={cn(
          'w-full rounded-full py-4 text-[17px] font-extrabold text-white shadow-lg transition active:scale-[0.985]',
          !canProceed || off
            ? 'cursor-not-allowed bg-border text-white/70'
            : 'linkup-gradient-primary hover:opacity-95'
        )}
      >
        {off ? 'Please wait…' : submitLabel}
      </button>

      {accountName && consent && allowOneTime ? (
        <button
          type="button"
          disabled={off}
          onClick={() => void handleSubmit(false)}
          className="w-full text-center text-[14px] font-extrabold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          Use once (do not save)
        </button>
      ) : null}
    </div>
  );
}
