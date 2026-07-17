import { MyJoinRequestScreen } from '@/features/plans/MyJoinRequestScreen';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { DbPlan, JoinRequestStatus } from '@/types/database';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your request' };

type Props = { params: Promise<{ id: string }> };

export default async function MyJoinRequestPage({ params }: Props) {
  const { id: planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase env vars to load your request.</p>
    );
  }

  const supabase = await createClient();
  const user = await getServerAuthUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    redirect(`/login?next=${encodeURIComponent(`/plan/${planId}/requests/my`)}`);
  }

  const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();
  if (!plan) redirect('/discover');

  const { data: joinReq } = await supabase
    .from('plan_join_requests')
    .select('status')
    .eq('plan_id', planId)
    .eq('requester_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <MyJoinRequestScreen
      plan={plan as DbPlan}
      initialStatus={(joinReq?.status as JoinRequestStatus | undefined) ?? null}
      currentUserId={currentUserId}
    />
  );
}
