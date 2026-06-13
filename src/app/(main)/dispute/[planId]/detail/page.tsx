import { DisputeDetailView } from '@/features/disputes/DisputeDetailView';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { DbDispute, DbDisputeEvidence } from '@/types/database';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ planId: string }> };

export default async function DisputeDetailPage({ params }: Props) {
  const { planId } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to view disputes.</p>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: dispute } = await supabase
    .from('disputes')
    .select('*')
    .eq('plan_id', planId)
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dispute) {
    return (
      <div className="linkup-card px-6 py-12 text-center">
        <p className="font-extrabold text-foreground">Dispute not found</p>
        <Link href="/disputes" className="mt-3 inline-block font-extrabold text-primary underline">
          Back to disputes
        </Link>
      </div>
    );
  }

  const { data: evidence } = await supabase
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', dispute.id)
    .order('created_at', { ascending: true });

  const evidenceWithUrls = await Promise.all(
    ((evidence ?? []) as DbDisputeEvidence[]).map(async (e) => {
      if (!e.file_path) return { ...e, signedUrl: null };
      const { data } = await supabase.storage
        .from('private_disputes')
        .createSignedUrl(e.file_path, 3600);
      return { ...e, signedUrl: data?.signedUrl ?? null };
    })
  );

  const { data: plan } = await supabase
    .from('plans')
    .select('title')
    .eq('id', planId)
    .maybeSingle();

  return (
    <DisputeDetailView
      dispute={dispute as DbDispute}
      evidence={evidenceWithUrls}
      planTitle={(plan?.title as string | null) ?? null}
    />
  );
}
