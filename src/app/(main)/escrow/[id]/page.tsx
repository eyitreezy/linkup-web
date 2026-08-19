import { EscrowDetailScreen } from '@/features/escrow/EscrowDetailScreen';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ planId?: string; offerId?: string; joinRequestId?: string }>;
};

export async function generateMetadata() {
  return { title: 'Secure payment' };
}

export default async function EscrowPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { planId, offerId, joinRequestId } = await searchParams;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to load escrow details.</p>
    );
  }

  return (
    <EscrowDetailScreen
      escrowId={id}
      agreementPlanId={planId}
      agreementOfferId={offerId}
      agreementJoinRequestId={joinRequestId}
    />
  );
}
