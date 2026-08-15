import { InvitationDetailClient } from '@/features/plans/InvitationDetailScreen';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { DbPlan, DbPlanInvitation } from '@/types/database';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invitation' };

type Props = { params: Promise<{ id: string; invitationId: string }> };

export default async function InvitationDetailPage({ params }: Props) {
  const { id: planId, invitationId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase env vars to load this invitation.</p>
    );
  }

  const supabase = await createClient();
  const user = await getServerAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/plan/${planId}/invitation/${invitationId}`)}`);
  }

  await supabase.rpc('claim_plan_invitation_for_user', { p_invitation_id: invitationId });

  const [{ data: invitation }, { data: plan }] = await Promise.all([
    supabase.from('plan_invitations').select('*').eq('id', invitationId).single(),
    supabase.from('plans').select('*').eq('id', planId).single(),
  ]);

  if (!invitation || !plan || invitation.plan_id !== planId) notFound();

  const isInvitee =
    invitation.invitee_user_id === user.id ||
    (invitation.invitee_email != null &&
      user.email != null &&
      invitation.invitee_email.toLowerCase() === user.email.toLowerCase());

  if (!isInvitee) notFound();

  const { data: hostProf } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', invitation.host_id)
    .maybeSingle();

  const { data: dbUser } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle();

  const isKycApproved = dbUser?.verification_status === 'verified';

  return (
    <InvitationDetailClient
      invitation={invitation as DbPlanInvitation}
      plan={plan as DbPlan}
      hostName={hostProf?.display_name ?? null}
      hostAvatar={hostProf?.avatar_url ?? null}
      isKycApproved={isKycApproved}
    />
  );
}
