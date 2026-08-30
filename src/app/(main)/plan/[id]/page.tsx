import { PlanDetailScreen } from '@/features/plans/PlanDetailScreen';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchCreatorPlanById } from '@/services/planManagement.service';
import { fetchPlanDetailBundle } from '@/services/planDetail.service';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (!isSupabaseConfigured) return { title: 'Plan' };
  const supabase = await createClient();
  const { data } = await fetchPlanDetailBundle(supabase, id, null);
  return { title: data?.plan.title ?? 'Plan details' };
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase env vars to load plan details.</p>
    );
  }

  const user = await getServerAuthUser();
  const currentUserId = user?.id ?? null;

  if (!currentUserId) {
    redirect(`/login?next=${encodeURIComponent(`/plan/${id}`)}`);
  }

  const supabase = await createClient();
  let { data: initialBundle, error } = await fetchPlanDetailBundle(supabase, id, currentUserId);

  if ((error || !initialBundle) && currentUserId) {
    const { plan: creatorPlan } = await fetchCreatorPlanById(supabase, id);
    if (creatorPlan?.creator_id === currentUserId) {
      const retry = await fetchPlanDetailBundle(supabase, id, currentUserId);
      initialBundle = retry.data;
      error = retry.error;
    }
  }

  if (error || !initialBundle) notFound();

  return (
    <PlanDetailScreen planId={id} currentUserId={currentUserId} initialBundle={initialBundle} />
  );
}
