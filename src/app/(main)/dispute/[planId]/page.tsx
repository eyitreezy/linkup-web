import { DisputeReportClient } from '@/features/disputes/DisputeReportClient';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ planId: string }> };

export default async function DisputeReportPage({ params }: Props) {
  const { planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to report disputes.</p>
    );
  }

  const user = await getServerAuthUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/dispute/${planId}`)}`);

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, creator_id, accepted_offer_id')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) notFound();

  let reportedUserId = plan.creator_id === user.id ? '' : plan.creator_id;
  if (plan.creator_id === user.id && plan.accepted_offer_id) {
    const { data: offer } = await supabase
      .from('plan_offers')
      .select('bidder_id')
      .eq('id', plan.accepted_offer_id)
      .maybeSingle();
    reportedUserId = offer?.bidder_id ?? '';
  }

  return (
    <Suspense fallback={<p className="text-[14px] font-semibold text-muted">Loading…</p>}>
      <DisputeReportClient
        planId={planId}
        planTitle={plan.title}
        reportedUserId={reportedUserId}
      />
    </Suspense>
  );
}
