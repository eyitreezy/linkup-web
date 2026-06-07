import { PlanDetailScreen } from '@/features/plans/PlanDetailScreen';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchPlanById } from '@/services/plans.service';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (!isSupabaseConfigured) return { title: 'Plan' };
  const supabase = await createClient();
  const { data } = await fetchPlanById(supabase, id);
  return { title: data?.title ?? 'Plan details' };
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase env vars to load plan details.</p>
    );
  }

  const supabase = await createClient();
  const { data: plan, error } = await fetchPlanById(supabase, id);

  if (error || !plan) notFound();

  return <PlanDetailScreen planId={id} initialPlan={plan} />;
}
