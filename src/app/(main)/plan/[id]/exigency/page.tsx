import { ExigencyReportClient } from '@/features/plans/ExigencyReportClient';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: 'Exigency Report' };
}

export default async function PlanExigencyPage({ params }: Props) {
  const { id: planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to submit exigency reports.</p>
    );
  }

  const user = await getServerAuthUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/plan/${planId}/exigency`)}`);

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, is_group_plan')
    .eq('id', planId)
    .maybeSingle();

  if (!plan || !plan.is_group_plan) notFound();

  return <ExigencyReportClient planId={planId} planTitle={plan.title} />;
}
