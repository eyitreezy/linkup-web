import { EscrowDetailScreen } from '@/features/escrow/EscrowDetailScreen';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: 'Secure payment' };
}

export default async function EscrowPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to load escrow details.</p>
    );
  }

  return <EscrowDetailScreen escrowId={id} />;
}
