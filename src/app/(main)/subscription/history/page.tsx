import { SubscriptionHistoryList } from '@/components/subscription/SubscriptionHistoryList';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { DbSubscriptionEvent } from '@/types/database';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Subscription history' };

export const dynamic = 'force-dynamic';

export default async function SubscriptionHistoryPage() {
  if (!isSupabaseConfigured) {
    return <p className="text-[14px] font-semibold text-muted">Configure Supabase to view history.</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: events } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return <SubscriptionHistoryList events={(events ?? []) as DbSubscriptionEvent[]} />;
}
