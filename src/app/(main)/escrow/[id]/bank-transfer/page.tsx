import { BankTransferClient } from '@/components/escrow/BankTransferClient';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { DbEscrowTransaction } from '@/types/database';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ planId?: string }>;
};

export async function generateMetadata() {
  return { title: 'Bank transfer payment' };
}

function resolveEscrowLeg(
  escrow: Pick<DbEscrowTransaction, 'escrow_pattern' | 'host_id' | 'guest_id' | 'host_funded_at' | 'guest_funded_at'>,
  userId: string
): 'host' | 'guest' | undefined {
  if (escrow.escrow_pattern !== 'B') return undefined;
  if (userId === escrow.host_id && !escrow.host_funded_at) return 'host';
  if (userId === escrow.guest_id && !escrow.guest_funded_at) return 'guest';
  return undefined;
}

export default async function BankTransferPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { planId } = await searchParams;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to load bank transfer payment.</p>
    );
  }

  const user = await getServerAuthUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: escrow } = await supabase
    .from('escrow_transactions')
    .select(
      'id, amount_cents, plan_id, status, escrow_pattern, host_id, guest_id, payer_id, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents'
    )
    .eq('id', id)
    .maybeSingle();

  if (!escrow || escrow.status !== 'pending_funding') {
    redirect(`/escrow/${id}`);
  }

  const escrowLeg = resolveEscrowLeg(escrow, user.id);
  if (escrow.escrow_pattern === 'B' && !escrowLeg) {
    redirect(`/escrow/${id}`);
  }
  if (escrow.escrow_pattern === 'A' && user.id !== escrow.host_id) {
    redirect(`/escrow/${id}`);
  }
  if (escrow.escrow_pattern === 'C' && user.id !== escrow.guest_id) {
    redirect(`/escrow/${id}`);
  }
  if (
    escrow.escrow_pattern !== 'A' &&
    escrow.escrow_pattern !== 'B' &&
    escrow.escrow_pattern !== 'C' &&
    user.id !== escrow.payer_id
  ) {
    redirect(`/escrow/${id}`);
  }

  const { data: savedAccount } = await supabase
    .from('user_payment_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle();

  return (
    <BankTransferClient
      escrow={escrow as DbEscrowTransaction}
      savedAccount={savedAccount}
      currentUserId={user.id}
      escrowLeg={escrowLeg}
      agreementPlanId={planId}
    />
  );
}
