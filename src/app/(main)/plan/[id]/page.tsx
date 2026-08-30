import { PlanDetailScreen } from '@/features/plans/PlanDetailScreen';
import { AuthRouteLoader } from '@/components/auth/AuthRouteLoader';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchPlanDetailBundle } from '@/services/planDetail.service';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (!isSupabaseConfigured) return { title: 'Plan' };
  const user = await getServerAuthUser();
  const supabase = await createClient();
  const { data } = await fetchPlanDetailBundle(supabase, id, user?.id ?? null);
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
  const { data: initialBundle, error } = await fetchPlanDetailBundle(supabase, id, currentUserId);

  if (error || !initialBundle) notFound();

  return (
    <Suspense fallback={<AuthRouteLoader variant="inline" />}>
      <PlanDetailScreen planId={id} currentUserId={currentUserId} initialBundle={initialBundle} />
    </Suspense>
  );
}
