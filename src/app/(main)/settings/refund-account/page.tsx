import { RefundAccountSettingsScreen } from '@/features/settings/RefundAccountSettingsScreen';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Refund account' };

export default async function RefundAccountSettingsPage() {
  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to manage refund accounts.</p>
    );
  }

  const user = await getServerAuthUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: savedAccount } = await supabase
    .from('user_payment_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle();

  return <RefundAccountSettingsScreen initialAccount={savedAccount} />;
}
