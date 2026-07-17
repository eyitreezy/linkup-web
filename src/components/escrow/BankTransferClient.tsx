'use client';

import { EscrowScreenHeader } from '@/components/escrow/EscrowScreenHeader';
import { RefundAccountForm, type RefundAccountResult } from '@/components/escrow/RefundAccountForm';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { generateVirtualAccount } from '@/lib/escrow/virtualAccountPayment';
import { createClient } from '@/lib/supabase/client';
import { userEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import type { DbEscrowTransaction, DbUserPaymentAccount } from '@/types/database';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoCheckmarkCircle, IoCopyOutline, IoTimeOutline } from 'react-icons/io5';

type VirtualAccountState = {
  sessionId: string;
  accountNumber: string;
  bankName: string;
  amountCents: number;
  expiresAt: string;
};

type Props = {
  escrow: Pick<DbEscrowTransaction, 'id' | 'amount_cents' | 'plan_id' | 'status' | 'escrow_pattern' | 'host_id' | 'guest_id' | 'host_funded_at' | 'guest_funded_at' | 'host_share_cents' | 'guest_share_cents'>;
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

  const backHref = agreementPlanId ? `/escrow/${escrow.id}?planId=${agreementPlanId}` : `/escrow/${escrow.id}`;
  const successHref = agreementPlanId
    ? `/plan/${escrow.plan_id}/agreement?planId=${agreementPlanId}`
    : `/plan/${escrow.plan_id}/agreement`;

  const handleFunded = useCallback(() => {
    router.replace(successHref);
  }, [router, successHref]);

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
    if (step !== 'virtual_account') return;

    const poll = setInterval(() => {
      void (async () => {
        const { data } = await client
          .from('escrow_transactions')
          .select(
            'id, status, escrow_pattern, host_id, guest_id, host_funded_at, guest_funded_at, amount_cents, host_share_cents, guest_share_cents'
          )
          .eq('id', escrow.id)
          .maybeSingle();
        if (!data) return;
        const row = data as DbEscrowTransaction;
        if (
          row.status === 'funded' ||
          row.status === 'active' ||
          userEscrowLegFunded(row, currentUserId)
        ) {
          handleFunded();
        }
      })();
    }, 3000);

    return () => clearInterval(poll);
  }, [client, currentUserId, escrow.id, handleFunded, step]);

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
        (payload) => {
          const next = payload.new as { status?: string };
          if (next.status === 'funded') handleFunded();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client, escrow.id, handleFunded, step]);

  async function onRefundComplete(result: RefundAccountResult) {
    setBusy(true);
    setError(null);
    try {
      const params =
        result.mode === 'saved'
          ? { escrowId: escrow.id, escrowLeg, refundAccountId: result.accountId }
          : {
              escrowId: escrow.id,
              escrowLeg,
              oneTimeRefundBankCode: result.bankCode,
              oneTimeRefundAccountNumber: result.accountNumber,
              oneTimeRefundAccountName: result.accountName,
            };
      const session = await generateVirtualAccount(params);
      setVa({
        sessionId: session.session_id,
        accountNumber: session.account_number,
        bankName: session.bank_name,
        amountCents: session.amount_cents,
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
    setVa(null);
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
            {step === 'refund_account' ? 'Refund account' : 'Transfer payment'}
          </h1>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
            {step === 'refund_account'
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

      {step === 'refund_account' ? (
        <RefundAccountForm
          userId={currentUserId}
          savedAccount={savedAccount}
          onComplete={onRefundComplete}
          busy={busy}
        />
      ) : va ? (
        <>
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
                <p className="font-display text-lg font-extrabold text-primary">{formatNGN(va.amountCents)}</p>
              </div>

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
          ) : null}
        </>
      ) : null}
    </div>
  );
}
