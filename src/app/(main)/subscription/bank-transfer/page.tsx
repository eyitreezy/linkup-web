import { SubscriptionBankTransferClient } from '@/components/subscription/SubscriptionBankTransferClient';
import { TIER_META } from '@/lib/subscription/constants';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { BillingCycle, PaidTier } from '@/lib/subscription/types';
import type { DbUserPaymentAccount } from '@/types/database';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Pay by bank transfer' };

type Props = {
  searchParams: Promise<{ tier?: string; cycle?: string }>;
};

const PAID_TIERS: PaidTier[] = ['SILVER', 'GOLD', 'PLATINUM'];

export default async function SubscriptionBankTransferPage({ searchParams }: Props) {
  const user = await getServerAuthUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const tier = (params.tier ?? '').toUpperCase() as PaidTier;
  const cycle = (params.cycle ?? 'monthly') as BillingCycle;

  if (!PAID_TIERS.includes(tier) || !['monthly', 'annual'].includes(cycle)) {
    redirect('/subscription');
  }

  const price = TIER_META[tier].price;
  const amountNgn = cycle === 'annual' ? price?.annual : price?.monthly;
  if (!amountNgn) redirect('/subscription');

  let savedAccount: DbUserPaymentAccount | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('user_payment_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .maybeSingle();
    savedAccount = (data as DbUserPaymentAccount | null) ?? null;
  }

  return (
    <SubscriptionBankTransferClient
      tier={tier}
      billingCycle={cycle}
      amountCents={amountNgn * 100}
      currentUserId={user.id}
      savedAccount={savedAccount}
    />
  );
}
