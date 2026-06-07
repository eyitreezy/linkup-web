'use client';

import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { applyPremiumPurchase } from '@/lib/premium/applyPurchase';
import { formatTierPrice, getTier } from '@/lib/premium/catalog';
import { openPremiumPaystackCheckout } from '@/lib/premium/openPremiumCheckout';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { IoCardOutline, IoCheckmarkCircleOutline, IoLockClosedOutline } from 'react-icons/io5';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-[17px] font-extrabold leading-snug text-foreground">{value}</p>
    </div>
  );
}

export function PremiumCheckoutScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tier = getTier(searchParams.get('tier')) ?? getTier('monthly')!;
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function pay() {
    if (!user?.id || !user.email) {
      setPayError('Sign in with an email to continue.');
      return;
    }
    setPayError(null);
    setBusy(true);
    const res = await openPremiumPaystackCheckout({
      email: user.email,
      userId: user.id,
      tier,
    });
    setBusy(false);
    if (!res.ok) setPayError(res.error ?? 'Could not open checkout.');
  }

  async function demoComplete() {
    if (!user?.id) return;
    setPayError(null);
    setBusy(true);
    const client = createClient();
    const { error } = await applyPremiumPurchase(client, user.id, tier);
    setBusy(false);
    if (error) setPayError(error);
    else {
      await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
      router.replace('/premium/success');
    }
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to checkout.
      </p>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Checkout"
        title="Complete your membership"
        subtitle="Secure payment via Paystack. Entitlements activate after confirmation."
        backHref="/premium"
        backLabel="Back to membership"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/20 bg-white/90 px-3 py-2 text-[13px] font-extrabold text-primary shadow-sm">
            <IoCardOutline size={16} aria-hidden />
            {tier.title}
          </span>
        }
      />

      <PremiumSectionHead title="Order summary" />

      <div className="linkup-card divide-y divide-primary/10 p-6">
        <SummaryRow label="Plan" value={`${tier.title} · ${tier.subtitle}`} />
        <SummaryRow label="Price" value={formatTierPrice(tier)} />
        <SummaryRow label="Duration" value={`${tier.durationDays} days`} />
        <SummaryRow label="Bonus boosts" value={`+${tier.bonusBoostCredits} credits`} />
      </div>

      <PremiumSectionHead title="Payment" />

      {payError ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
          {payError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void pay()}
        className={cn(
          'flex w-full min-h-[56px] items-center justify-center gap-2.5 rounded-full px-6 text-[17px] font-extrabold text-white shadow-lg transition',
          busy ? 'bg-border' : 'linkup-gradient-primary hover:opacity-95 active:scale-[0.985]'
        )}
      >
        {busy ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <>
            <IoLockClosedOutline size={20} aria-hidden />
            Pay with Paystack
          </>
        )}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void demoComplete()}
        className="w-full rounded-full p-[2px] linkup-gradient-primary shadow-md transition active:scale-[0.985] disabled:opacity-55"
      >
        <span className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-surface px-4 text-[16px] font-extrabold text-secondary">
          {busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          ) : (
            <>
              <IoCheckmarkCircleOutline size={20} aria-hidden />
              I completed payment (demo unlock)
            </>
          )}
        </span>
      </button>

      <p className="text-center text-[13px] font-semibold leading-relaxed text-muted">
        Payments are processed securely. Verification is still required for paid meetups and escrow.
      </p>
    </div>
  );
}
