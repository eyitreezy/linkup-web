import { ReviewMeetupClient } from '@/features/plans/ReviewMeetupClient';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: 'Leave a review' };
}

export default async function PlanReviewPage({ params }: Props) {
  const { id: planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to leave a review.</p>
    );
  }

  const user = await getServerAuthUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/plan/${planId}/review`)}`);

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, review_unlock_at')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) notFound();
  if (!plan.review_unlock_at) redirect(`/plan/${planId}`);

  return <ReviewMeetupClient planId={planId} planTitle={plan.title} />;
}
