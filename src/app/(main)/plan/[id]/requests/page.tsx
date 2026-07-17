import { ManageRequestsScreen } from '@/features/plans/ManageRequestsScreen';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import type { JoinRequestWithRequester } from '@/lib/plans/joinRequests';
import { createClient } from '@/lib/supabase/server';
import type { DbPlan, DbPlanJoinRequest } from '@/types/database';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Manage requests' };

type Props = { params: Promise<{ id: string }> };

export default async function ManageRequestsPage({ params }: Props) {
  const { id: planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase env vars to load requests.</p>
    );
  }

  const supabase = await createClient();
  const user = await getServerAuthUser();
  const currentUserId = user?.id;

  const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();

  if (!plan || plan.creator_id !== currentUserId) {
    redirect(`/plan/${planId}`);
  }

  const { data: requestsRaw } = await supabase
    .from('plan_join_requests')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });

  const requests = (requestsRaw ?? []) as DbPlanJoinRequest[];
  let initialRequests: JoinRequestWithRequester[] = requests.map((row) => ({
    ...row,
    requester: null,
  }));

  if (requests.length > 0) {
    const ids = [...new Set(requests.map((r) => r.requester_id))];
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls')
      .in('user_id', ids);

    const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
    initialRequests = requests.map((row) => {
      const prof = byId.get(row.requester_id);
      return {
        ...row,
        requester: prof
          ? {
              display_name: prof.display_name,
              avatar_url: prof.avatar_url,
              primary_photo_url: prof.primary_photo_url,
              photo_urls: prof.photo_urls,
            }
          : null,
      };
    });
  }

  return <ManageRequestsScreen plan={plan as DbPlan} initialRequests={initialRequests} />;
}
