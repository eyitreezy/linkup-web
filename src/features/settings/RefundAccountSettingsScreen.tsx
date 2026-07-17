'use client';

import { RefundAccountForm } from '@/components/escrow/RefundAccountForm';
import { deletePaymentAccount, fetchSavedPaymentAccount, maskAccountNumber } from '@/lib/escrow/virtualAccountPayment';
import { useAuthStore } from '@/stores/auth-store';
import type { DbUserPaymentAccount } from '@/types/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IoArrowBack } from 'react-icons/io5';

export function RefundAccountSettingsScreen({
  initialAccount,
}: {
  initialAccount: DbUserPaymentAccount | null;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [account, setAccount] = useState(initialAccount);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void fetchSavedPaymentAccount(user.id).then(setAccount);
  }, [user?.id]);

  async function onRemove() {
    if (!account) return;
    setRemoving(true);
    setError(null);
    try {
      await deletePaymentAccount(account.id);
      setAccount(null);
      router.push('/settings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove account');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 shadow-sm transition hover:bg-[#EDE8FF]/60"
          aria-label="Back to settings"
        >
          <IoArrowBack size={22} />
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Refund account</h1>
      </div>

      {error ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
          {error}
        </p>
      ) : null}

      {account && user?.id ? (
        <div className="space-y-4">
          <div className="linkup-card space-y-1 p-5">
            <p className="text-[15px] font-extrabold text-foreground">{account.bank_name}</p>
            <p className="text-[14px] font-semibold text-muted">{maskAccountNumber(account.account_number)}</p>
            <p className="text-[14px] font-semibold text-foreground">{account.account_name}</p>
          </div>
          <button
            type="button"
            disabled={removing}
            onClick={() => void onRemove()}
            className="w-full rounded-full border border-[#FECACA] bg-white py-3.5 text-[15px] font-extrabold text-[#EF4444] transition hover:bg-[#FEF2F2] disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove account'}
          </button>
        </div>
      ) : null}

      {user?.id ? (
        <RefundAccountForm
          userId={user.id}
          savedAccount={null}
          submitLabel="Save refund account"
          allowOneTime={false}
          onComplete={async () => {
            router.push('/settings');
          }}
        />
      ) : null}
    </div>
  );
}
