import { ConfirmMeetupClient } from '@/features/plans/ConfirmMeetupClient';
import { GroupGuestConfirmClient } from '@/features/plans/GroupGuestConfirmClient';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: 'Confirm meetup' };
}

export default async function PlanConfirmMeetupPage({ params }: Props) {
  const { id: planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to confirm meetups.</p>
    );
  }

  const user = await getServerAuthUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/plan/${planId}/confirm`)}`);

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, status, creator_id, accepted_offer_id, is_group_plan')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) notFound();

  if (plan.is_group_plan && plan.creator_id !== user.id) {
    const { data: guestConfirm } = await supabase
      .from('group_plan_confirmations')
      .select('user_id')
      .eq('plan_id', planId)
      .eq('user_id', user.id)
      .maybeSingle();

    return (
      <GroupGuestConfirmClient
        planId={planId}
        planTitle={plan.title}
        alreadyConfirmed={!!guestConfirm}
      />
    );
  }

  const { data: ack } = await supabase
    .from('plan_completion_acks')
    .select('user_id')
    .eq('plan_id', planId)
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <ConfirmMeetupClient
      planId={planId}
      planTitle={plan.title}
      alreadyConfirmed={!!ack}
    />
  );
}
