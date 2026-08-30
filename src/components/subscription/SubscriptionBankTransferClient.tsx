'use client';

import { RefundAccountForm, type RefundAccountResult } from '@/components/escrow/RefundAccountForm';
import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { formatNgn } from '@/lib/subscription/constants';
import {
  checkSubscriptionBankTransferFunded,
  confirmSandboxSubscriptionBankTransfer,
  createSubscriptionBankTransferSession,
  syncSubscriptionFromBankTransfer,
} from '@/lib/subscription/subscriptionBankTransfer';
import { clearPermissionCache } from '@/lib/subscription/checkPermission';
import {
  clearSubscriptionCheckoutTxRef,
  saveSubscriptionCheckoutTxRef,
} from '@/lib/subscription/subscriptionCheckoutSession';
import { createClient } from '@/lib/supabase/client';
import type { BillingCycle, PaidTier } from '@/lib/subscription/types';
import type { DbUserPaymentAccount } from '@/types/database';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCardOutline, IoCopyOutline, IoTimeOutline } from 'react-icons/io5';

type Props = {
  tier: PaidTier;
  billingCycle: BillingCycle;
  amountCents: number;
  currentUserId: string;
  savedAccount: DbUserPaymentAccount | null;
};

type VirtualAccountState = {
  sessionId: string;
  txRef: string;
  accountNumber: string;
  bankName: string;
  amountCents: number;
  expiresAt: string;
};

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function isSandboxBankName(bankName: string | null | undefined): boolean {
  const name = (bankName ?? '').trim().toLowerCase();
  return name.includes('mock') || name.includes('test') || name === 'virtual bank';
}

export function SubscriptionBankTransferClient({
  tier,
  billingCycle,
  amountCents,
  currentUserId,
  savedAccount,
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
  const [manualCheckBusy, setManualCheckBusy] = useState(false);
  const fundedRef = useRef(false);

  const isSandboxTransfer = va ? isSandboxBankName(va.bankName) : false;

  const checkFundingStatus = useCallback(async () => {
    if (!va || fundedRef.current) return;
    await syncSubscriptionFromBankTransfer(client, va.sessionId);
    const funded = await checkSubscriptionBankTransferFunded(client, va.sessionId);
    if (funded) {
      fundedRef.current = true;
      clearPermissionCache();
      clearSubscriptionCheckoutTxRef();
      router.replace('/subscription?activated=1');
    }
  }, [client, router, va]);

  useEffect(() => {
    if (step !== 'virtual_account' || !va || fundedRef.current) return;
    const tick = () => {
      const ms = new Date(va.expiresAt).getTime() - Date.now();
      setCountdownMs(ms);
      setIsExpired(ms <= 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [step, va]);

  useEffect(() => {
    if (step !== 'virtual_account' || fundedRef.current) return;
    void checkFundingStatus();
    if (isSandboxTransfer) return;
    const poll = setInterval(() => void checkFundingStatus(), 5000);
    return () => clearInterval(poll);
  }, [checkFundingStatus, isSandboxTransfer, step]);

  async function onRefundComplete(result: RefundAccountResult) {
    setBusy(true);
    setError(null);
    try {
      const created = await createSubscriptionBankTransferSession(client, {
        tier,
        billingCycle,
        refundAccount: result,
      });
      if (created.error || !created.session) {
        throw new Error(created.error ?? 'Could not start bank transfer');
      }
      saveSubscriptionCheckoutTxRef(created.session.txRef);
      setVa(created.session);
      setStep('virtual_account');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate virtual account');
    } finally {
      setBusy(false);
    }
  }

  async function onSandboxConfirm() {
    if (!va) return;
    setManualCheckBusy(true);
    setError(null);
    try {
      const result = await confirmSandboxSubscriptionBankTransfer(client, va.sessionId);
      if (!result.ok) throw new Error(result.error ?? 'Sandbox confirm failed');
      fundedRef.current = true;
      clearPermissionCache();
      router.replace('/subscription?activated=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm test payment');
    } finally {
      setManualCheckBusy(false);
    }
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
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <TabPageHeader
        kicker="Membership"
        title="Pay by bank transfer"
        description={`Complete your ${tier} subscription (${billingCycle}) by transferring the exact amount below.`}
        icon={<IoCardOutline size={22} />}
      />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {step === 'refund_account' ? (
        <div className="linkup-card p-5">
          <p className="text-[14px] font-semibold leading-relaxed text-muted">
            Add a refund account first. We use it if a subscription payment needs to be returned.
          </p>
          <div className="mt-4">
            <RefundAccountForm
              userId={currentUserId}
              savedAccount={savedAccount}
              onComplete={(result) => void onRefundComplete(result)}
              busy={busy}
              submitLabel="Continue to bank transfer"
            />
          </div>
        </div>
      ) : null}

      {step === 'virtual_account' && va ? (
        <div className="linkup-card space-y-4 p-5">
          <div className="rounded-xl border border-primary/15 bg-[#F5F6FA] p-4">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Transfer exactly</p>
            <p className="font-display text-3xl font-extrabold text-foreground">
              {formatNgn(va.amountCents / 100)}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-muted">to the account below</p>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 p-4">
            <div className="flex justify-between gap-3 text-[14px]">
              <span className="font-semibold text-muted">Bank</span>
              <span className="font-extrabold text-foreground">{va.bankName}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="font-semibold text-muted">Account number</span>
              <button
                type="button"
                onClick={() => void onCopy()}
                className="inline-flex items-center gap-1.5 font-extrabold text-primary"
              >
                {va.accountNumber}
                <IoCopyOutline size={16} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
              <IoTimeOutline size={16} />
              {isExpired ? 'Session expired' : `Expires in ${formatCountdown(countdownMs)}`}
            </div>
          </div>

          <p className="text-[13px] font-semibold leading-relaxed text-muted">
            Your subscription activates after we confirm the transfer. This page updates automatically.
          </p>

          {isSandboxTransfer ? (
            <button
              type="button"
              disabled={manualCheckBusy}
              onClick={() => void onSandboxConfirm()}
              className={cn(
                'flex min-h-[48px] w-full items-center justify-center rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white disabled:opacity-50'
              )}
            >
              {manualCheckBusy ? 'Confirming…' : 'Confirm test bank transfer'}
            </button>
          ) : (
            <button
              type="button"
              disabled={manualCheckBusy}
              onClick={() => void checkFundingStatus()}
              className="flex min-h-[48px] w-full items-center justify-center rounded-full border border-primary/25 bg-white px-4 text-[14px] font-extrabold text-primary disabled:opacity-50"
            >
              {manualCheckBusy ? 'Checking…' : 'I have paid — check again'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
