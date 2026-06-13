import { SubscriptionHistoryList } from '@/components/subscription/SubscriptionHistoryList';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { DbSubscriptionEvent } from '@/types/database';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Subscription events' };

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ userId: string }> };

export default async function AdminUserSubscriptionEventsPage({ params }: Props) {
  const { userId } = await params;

  if (!isSupabaseConfigured) {
    return <p className="text-[14px] font-semibold text-muted">Configure Supabase to view events.</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: adminRow } = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) {
    return (
      <div className="linkup-card px-6 py-12 text-center">
        <p className="font-extrabold text-foreground">Admin access required</p>
        <Link href="/admin" className="mt-3 inline-block font-extrabold text-primary underline">
          Back to admin
        </Link>
      </div>
    );
  }

  const { data: events } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <SubscriptionHistoryList
      events={(events ?? []) as DbSubscriptionEvent[]}
      backHref="/admin"
      title="Subscription events"
    />
  );
}
